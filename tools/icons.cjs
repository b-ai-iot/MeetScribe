// Render the canonical local SVG at each Chrome extension icon size.
// Development-only: uses the existing Playwright dependency, no network assets.
const {chromium}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),source=await fs.readFile(path.join(root,'extension/icons/brand.svg'),'utf8');
 const browser=await chromium.launch(process.env.MEETSCRIBE_TEST_CHROME?{headless:true,executablePath:process.env.MEETSCRIBE_TEST_CHROME}:{headless:true,channel:'chromium'});
 try{
  const page=await browser.newPage({deviceScaleFactor:1});
  for(const size of [16,32,48,128]){
   await page.setViewportSize({width:size,height:size});
   await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`);
   await page.locator('svg').screenshot({path:path.join(root,`extension/icons/${size}.png`),omitBackground:true});
  }
 }finally{await browser.close();}
 console.log('Generated 16/32/48/128 PNG icons from icons/brand.svg');
})().catch(error=>{console.error(error);process.exitCode=1;});
