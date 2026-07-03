const sharp = require('sharp');
const pngToIcoObj = require('png-to-ico');
const pngToIco = pngToIcoObj.default || pngToIcoObj;
const fs = require('fs');
const path = require('path');

const srcLogo = 'C:\\Users\\User\\OneDrive\\Desktop\\OSEA_SOURCE\\40_MEDIA_AND_PEOPLE\\OSEA Media\\Logo\\OSEA_logo_new.png';
const outDir = path.join(__dirname, 'resources');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir);
}

const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];

async function generateIcons() {
    try {
        for (const size of sizes) {
            await sharp(srcLogo)
                .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
                .toFile(path.join(outDir, `${size}x${size}.png`));
        }

        const iconPngPath = path.join(outDir, 'icon.png');
        await sharp(srcLogo)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .toFile(iconPngPath);

        if (typeof pngToIco === 'function') {
            const buf = await pngToIco(iconPngPath);
            fs.writeFileSync(path.join(outDir, 'icon.ico'), buf);
        } else {
            console.error("pngToIco is not a function:", typeof pngToIco, Object.keys(pngToIcoObj));
            // Let's just create an empty file if it fails so electron builder doesn't crash?
            // Actually electron-builder handles it if icon.png is there.
        }

        const rendererAssetDir = path.join(__dirname, 'src', 'renderer', 'src', 'assets');
        if (!fs.existsSync(rendererAssetDir)) {
            fs.mkdirSync(rendererAssetDir, { recursive: true });
        }
        await sharp(srcLogo)
            .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .toFile(path.join(rendererAssetDir, 'osea-logo.png'));

        console.log("Icons generated successfully.");
    } catch (e) {
        console.error("Error generating icons:", e);
    }
}

generateIcons();