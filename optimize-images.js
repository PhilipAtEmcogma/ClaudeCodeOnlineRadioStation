const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function optimizeImages() {
  const publicDir = path.join(__dirname, 'public');
  const logoPath = path.join(publicDir, 'RadioCalicoLogoTM.png');

  if (!fs.existsSync(logoPath)) {
    console.error('Logo file not found:', logoPath);
    return;
  }

  console.log('Optimizing RadioCalicoLogoTM.png...');

  try {
    // Create optimized PNG (smaller size, same quality)
    await sharp(logoPath)
      .png({ quality: 90, compressionLevel: 9 })
      .toFile(path.join(publicDir, 'RadioCalicoLogoTM-optimized.png'));

    console.log('✓ Created optimized PNG');

    // Create WebP version (much smaller, excellent quality)
    await sharp(logoPath)
      .webp({ quality: 90 })
      .toFile(path.join(publicDir, 'RadioCalicoLogoTM.webp'));

    console.log('✓ Created WebP version');

    // Get file sizes for comparison
    const originalSize = fs.statSync(logoPath).size;
    const optimizedPngSize = fs.statSync(path.join(publicDir, 'RadioCalicoLogoTM-optimized.png')).size;
    const webpSize = fs.statSync(path.join(publicDir, 'RadioCalicoLogoTM.webp')).size;

    console.log('\nFile size comparison:');
    console.log(`Original PNG:    ${(originalSize / 1024).toFixed(2)} KB`);
    console.log(`Optimized PNG:   ${(optimizedPngSize / 1024).toFixed(2)} KB (${((1 - optimizedPngSize / originalSize) * 100).toFixed(1)}% smaller)`);
    console.log(`WebP:            ${(webpSize / 1024).toFixed(2)} KB (${((1 - webpSize / originalSize) * 100).toFixed(1)}% smaller)`);

    // Replace original with optimized version
    fs.renameSync(path.join(publicDir, 'RadioCalicoLogoTM-optimized.png'), logoPath);
    console.log('\n✓ Replaced original PNG with optimized version');

  } catch (error) {
    console.error('Error optimizing images:', error);
    process.exit(1);
  }
}

optimizeImages();
