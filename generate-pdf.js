const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const htmlPath = path.resolve(__dirname, 'index.html');
  const outputPath = path.resolve(__dirname, 'Expose-Werastrasse-24-Holzgerlingen.pdf');

  console.log('Launching Edge...');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Set download path to project directory
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: __dirname
  });

  console.log('Loading page...');
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // Wait for images to load
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(resolve => {
          img.onload = img.onerror = resolve;
        }))
    );
  });

  console.log('Generating PDF (this may take 30-60 seconds)...');

  // Temporarily re-enable the button so generatePDF() can find it
  await page.evaluate(() => {
    const btn = document.querySelector('.pdf-btn');
    if (btn) btn.style.display = 'flex';
  });

  // Call the generatePDF function - it will trigger a file download
  await page.evaluate(() => generatePDF());

  // Wait for the file to appear (up to 90 seconds)
  const start = Date.now();
  while (Date.now() - start < 90000) {
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 10000) break; // file has meaningful content
    }
    await new Promise(r => setTimeout(r, 1000));
    process.stdout.write('.');
  }

  await browser.close();

  if (fs.existsSync(outputPath)) {
    const size = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1);
    console.log(`\n✓ PDF saved: ${outputPath} (${size} MB)`);
  } else {
    console.error('\n✗ PDF file not found. The download may have failed.');
    process.exit(1);
  }
})();
