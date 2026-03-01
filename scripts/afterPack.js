const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

exports.default = async function(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  console.log(`Cleaning xattrs for codesign: ${appPath}`);

  // Copy app to /tmp via ditto to strip ALL extended attributes (including FileProvider)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'electron-clean-'));
  const tmpApp = path.join(tmpDir, path.basename(appPath));
  try {
    execSync(`ditto --norsrc "${appPath}" "${tmpApp}"`);
    execSync(`rm -rf "${appPath}"`);
    execSync(`ditto "${tmpApp}" "${appPath}"`);
  } finally {
    execSync(`rm -rf "${tmpDir}"`);
  }

  // Belt-and-suspenders: also run xattr -cr
  execSync(`xattr -cr "${appPath}" 2>/dev/null || true`);

  // Remove resource fork files
  execSync(`find "${appPath}" -name "._*" -delete 2>/dev/null || true`);
  execSync(`dot_clean "${appPath}" 2>/dev/null || true`);

  // Verify
  const frameworksPath = path.join(appPath, 'Contents', 'Frameworks');
  const result = execSync(`xattr -lr "${frameworksPath}" 2>&1 | grep -v "com.apple.cs" | head -5 || true`).toString().trim();
  console.log('Non-codesign xattrs remaining:', result || 'NONE (clean)');
};
