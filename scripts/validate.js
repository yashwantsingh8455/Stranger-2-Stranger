'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const root = path.resolve(__dirname, '..');
const activeHtml = ['index.html','login.html','social.html','Group-Chatroom.html','call.html','admin.html','analytics.html','iframe-groupchatroom.html'];
const required = [
  'server.js','social-features.js','package.json','.env.example','README.md','FEATURES-V2.md','UX-UPDATES-V3.md',
  'public/manifest.json','public/sw.js','public/icons/icon-192x192.png','public/icons/icon-512x512.png',
  ...activeHtml.map(x => `public/${x}`)
];
let failures = [];
function ok(msg){ console.log('✅', msg); }
function fail(msg){ failures.push(msg); console.error('❌', msg); }
function check(msg, condition){ condition ? ok(msg) : fail(msg); }
function checkSyntax(file, module=false){
  const p = path.join(root,file);
  try { cp.execFileSync(process.execPath,['--check',p],{stdio:'pipe'}); ok(`Syntax ${file}`); }
  catch(e){ fail(`Syntax ${file}: ${String(e.stderr||e.message)}`); }
}

for(const f of required) fs.existsSync(path.join(root,f)) ? ok(`Exists ${f}`) : fail(`Missing ${f}`);
checkSyntax('server.js'); checkSyntax('social-features.js'); checkSyntax('public/sw.js');

try { JSON.parse(fs.readFileSync(path.join(root,'public/manifest.json'),'utf8')); ok('manifest.json parses'); }
catch(e){ fail('manifest.json invalid: '+e.message); }

for(const name of activeHtml){
  const file=path.join(root,'public',name); if(!fs.existsSync(file))continue;
  const src=fs.readFileSync(file,'utf8');
  const scriptRe=/<script([^>]*)>([\s\S]*?)<\/script>/gi; let m, i=0;
  while((m=scriptRe.exec(src))){
    if(/\bsrc\s*=/.test(m[1])) continue;
    const ext=/type\s*=\s*["']module["']/i.test(m[1])?'.mjs':'.js';
    const tmp=path.join(os.tmpdir(),`s2s-${name.replace(/\W/g,'_')}-${i++}${ext}`);
    fs.writeFileSync(tmp,m[2]);
    try{ cp.execFileSync(process.execPath,['--check',tmp],{stdio:'pipe'}); }
    catch(e){ fail(`Inline JS ${name}: ${String(e.stderr||e.message)}`); }
    finally{ try{fs.unlinkSync(tmp)}catch{} }
  }
  if(!failures.some(x=>x.includes(`Inline JS ${name}`))) ok(`Inline JS ${name}`);
  const htmlOnly=src.replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'');
  const ids=[...htmlOnly.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(x=>x[1]);
  const dup=[...new Set(ids.filter((id,j)=>ids.indexOf(id)!==j))];
  dup.length?fail(`Duplicate static IDs in ${name}: ${dup.join(', ')}`):ok(`Static IDs ${name}`);
}

const scanFiles=['server.js','social-features.js',...activeHtml.map(x=>'public/'+x),'public/rightclick-aleart-dc.js'].filter(f=>fs.existsSync(path.join(root,f)));
const forbidden=[
  [/https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\//i,'Discord webhook URL'],
  [/mongodb\+srv:\/\/[^\s"']+:[^\s"']+@/i,'Hard-coded MongoDB credential'],
  [new RegExp('hey'+'uki2026','i'),'Old hard-coded admin password']
];
for(const f of scanFiles){ const src=fs.readFileSync(path.join(root,f),'utf8'); for(const [re,label] of forbidden) if(re.test(src)) fail(`${label} in ${f}`); }
if(!failures.some(x=>/credential|webhook|password/.test(x))) ok('Known secret patterns absent from active source');

const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
if(/REQUIRE_FIREBASE_AUTH\s*=\s*process\.env\.REQUIRE_FIREBASE_AUTH\s*!==\s*["']false["']/.test(server)) ok('Firebase auth defaults to required'); else fail('Firebase auth default is not clearly required');
if(/REQUIRE_EMAIL_VERIFIED\s*=\s*process\.env\.REQUIRE_EMAIL_VERIFIED\s*!==\s*["']false["']/.test(server)) ok('Email verification defaults to required'); else fail('Email verification default is not clearly required');

const groupChat=fs.readFileSync(path.join(root,'public/Group-Chatroom.html'),'utf8');
const social=fs.readFileSync(path.join(root,'social-features.js'),'utf8');
check('V3 compact message menu', groupChat.includes('msg-menu-trigger') && groupChat.includes('reaction-picker-popover'));
check('V3 self user label', groupChat.includes("isSelf?'You'"));
check('V3 blocked settings/history UI', groupChat.includes('blockedAccountsList') && groupChat.includes('blockedHistoryList'));
check('V3 block history API', social.includes('/api/social/blocks') && social.includes('BlockHistory'));
check('V3 chat settings persistence', social.includes('chatSettings') && social.includes('hideBlockedMessages'));

if(failures.length){ console.error(`\n${failures.length} validation failure(s).`); process.exit(1); }
console.log('\n🎉 Stranger 2 Stranger validation passed.');
