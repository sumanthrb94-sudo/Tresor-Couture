import { chromium } from '@playwright/test';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const p=await b.newPage({viewport:{width:1280,height:900}});
await p.goto('http://127.0.0.1:4173/#/login',{waitUntil:'domcontentloaded'});
await p.locator('#login-email').waitFor({timeout:20000});
await p.locator('#login-email').fill('customer@test.local');
await p.locator('#login-password').fill('Test1234!');
await p.getByRole('main').getByRole('button',{name:/^login$/i}).click();
await p.waitForFunction(()=>!location.hash.includes('login'),null,{timeout:25000});
const c=p.getByRole('button',{name:/essential only|accept/i}); if(await c.first().isVisible().catch(()=>0)) await c.first().click().catch(()=>{});
// add an item then go to checkout
await p.goto('http://127.0.0.1:4173/#/product/1',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(1500);
const add=p.getByRole('button',{name:/add to (bag|cart)/i}); if(await add.first().isVisible().catch(()=>0)) await add.first().click();
await p.waitForTimeout(800);
await p.goto('http://127.0.0.1:4173/#/checkout',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2000);
for (const label of ['Cash on Delivery','UPI','Card']) {
  const btn = p.getByRole('button').filter({hasText:label}).first();
  const dis = await btn.isDisabled().catch(()=>null);
  const sub = await btn.textContent().catch(()=>'');
  console.log(label.padEnd(18), 'disabled=', dis, '|', (sub||'').replace(/\s+/g,' ').trim().slice(0,45));
}
await p.screenshot({path:'/tmp/claude-0/-home-user-Tresor-Couture/032c8341-8752-527a-934b-e8820f30a5ea/scratchpad/pay-on.png'});
await b.close();
