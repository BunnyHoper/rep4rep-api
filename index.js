const readLine = require('readline');
const sqlite3 = require('sqlite3').verbose();
const SteamCommunity = require('steamcommunity');
const puppeteer = require('puppeteer');

const community = new SteamCommunity();
const config = require('./config.json');
const { version } = require('./package.json');

// GLOBAL CONFIGURATION STATE
let debugMode = false;
const UI_WIDTH = 86; 

const Fmt = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m",
    gray: "\x1b[90m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", 
    blue: "\x1b[34m", cyan: "\x1b[36m", white: "\x1b[37m",
    bgRed: "\x1b[41m", bgBlack: "\x1b[40m"
};

const rl = readLine.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// ᴀᴇѕᴛʜᴇᴛɪᴄ ᴄᴏɴᴠᴇʀᴛᴇʀ & ѕᴍᴀʀᴛ ѕᴀɴɪᴛɪᴢᴇʀ
const est = (str) => {
    if (!str) return '';
    let clean = str.replace(/[\u25A0-\u25FF]|\u2605|\u2606|[\uE000-\uF8FF]|\uFFFD/g, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    if (!clean) clean = str.trim();
    
    const map = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ꜰ', 'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ',
        'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ', 'ñ': 'ñ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
        's': 'ѕ', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'х', 'y': 'ʏ', 'z': 'ᴢ'
    };
    return clean.toLowerCase().split('').map(char => map[char] || char).join('');
};

const pad = (str, len) => {
    const strLen = str.length;
    if (strLen > len) return str.substring(0, len);
    return str + ' '.repeat(len - strLen);
};

const centerText = (text, width = UI_WIDTH) => {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
    if (stripped.length >= width) return text;
    const leftPadding = Math.floor((width - stripped.length) / 2);
    const rightPadding = width - stripped.length - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
};

// --- SET INITIAL TITLE ON BOOT IMMEDIATELY ---
process.stdout.write(`\x1b]0;ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ │ 0 ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);

const db = new sqlite3.Database('./steamprofiles.db', (err) => {
    if (err) process.exit(1);
    initializeSchema();
    db.all('SELECT id FROM steamprofiles', [], (dbErr, rows) => {
        const count = rows ? rows.length : 0;
        process.stdout.write(`\x1b]0;ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ │ ${count} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
        homeMenu();
    });
});

function initializeSchema() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS steamprofiles (
            id integer PRIMARY KEY AUTOINCREMENT,
            username varchar,
            steamId varchar UNIQUE,
            cookies text,
            token text,
            last_comment text
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS account_locks (
            steamId text PRIMARY KEY,
            lock_until text
        )`);
    });
}

async function updateWindowTitle() {
    try {
        const rows = await db_all('SELECT id FROM steamprofiles');
        process.stdout.write(`\x1b]0;ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ │ ${rows.length} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
    } catch (e) {
        process.stdout.write(`\x1b]0;ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ │ 0 ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
    }
}

function renderBox(title, content, color = Fmt.red) {
    const border = "─".repeat(UI_WIDTH - 2);
    console.log(`${color}┌${border}┐`);
    console.log(`│${Fmt.reset}${Fmt.bold}${centerText(title, UI_WIDTH - 2)}${Fmt.reset}${color}│`);
    console.log(`├${border}┤`);
    
    content.split('\n').forEach(line => {
        const paddingLeft = "    "; 
        const strippedLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        const targetWidth = UI_WIDTH - 2 - paddingLeft.length;
        const paddingRightCount = targetWidth - strippedLine.length;
        const paddingRight = paddingRightCount > 0 ? " ".repeat(paddingRightCount) : "";
        console.log(`│${Fmt.reset}${paddingLeft}${line}${paddingRight}${Fmt.reset}${color}│`);
    });
    console.log(`└${border}┘${Fmt.reset}`);
}

function displayHeader(subtitle = 'ᴅᴀѕʜʙᴏᴀʀᴅ') {
    console.log('\x1Bc');
    const border = "═".repeat(UI_WIDTH);
    console.log(`${Fmt.red}${border}${Fmt.reset}`);
    console.log(centerText(`${Fmt.bold}${Fmt.bgRed}${Fmt.white}  📂 ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ  ${Fmt.reset}  ${Fmt.dim}ᴠ${version}${Fmt.reset}`));
    console.log(centerText(`${Fmt.gray}ᴄᴏɴᴛᴇхᴛ ᴘᴀᴛʜ │ ${Fmt.reset}${Fmt.italic}${Fmt.red}${subtitle}${Fmt.reset}`));
    console.log(`${Fmt.red}${border}${Fmt.reset}\n`);
}

function printAccountsTable(profiles, locksMap = {}) {
    if (profiles.length > 0) {
        console.log(centerText(`${Fmt.bold}${Fmt.red}─ ʀᴇɢɪѕᴛᴇʀᴇᴅ ᴀᴄᴄᴏᴜɴᴛѕ ᴠᴀᴜʟᴛ ─${Fmt.reset}\n`));
        console.log(`${Fmt.red}┌────┬────────┬──────────────────────┬────────────────────┬──────────────────────────┐${Fmt.reset}`);
        console.log(`${Fmt.red}│ ɪᴅ │ ѕᴛᴀᴛᴜѕ │ ᴜѕᴇʀɴᴀᴍᴇ             │ ѕᴛᴇᴀᴍ ɪᴅ           │ ʟᴏᴄᴋ ᴛɪᴍᴇ                │${Fmt.reset}`);
        console.log(`${Fmt.red}├────┼────────┼──────────────────────┼────────────────────┼──────────────────────────┤${Fmt.reset}`);
        
        profiles.forEach(p => {
            const idStr = pad(p.displayLetter, 2);
            const statusIcon = p.isValid ? `${Fmt.green}   ✓    ${Fmt.red}` : `${Fmt.red}   х    ${Fmt.red}`;
            const uName = pad(est(p.username || ''), 20);
            const sId = pad((p.steamId || ''), 18);
            
            const lockTime = locksMap[p.steamId] || 0;
            const now = Date.now();
            let lockDisplay = '';
            
            if (lockTime > now) {
                const remainingHours = ((lockTime - now) / 3600000).toFixed(1);
                lockDisplay = `${Fmt.red}${pad(`${remainingHours} ʜ.`, 24)}${Fmt.red}`;
            } else {
                lockDisplay = `${Fmt.green}${pad('✓', 24)}${Fmt.red}`;
            }

            console.log(`${Fmt.red}│ ${Fmt.cyan}${idStr} ${Fmt.red}│${statusIcon}│ ${Fmt.white}${uName} ${Fmt.red}│ ${Fmt.gray}${sId} ${Fmt.red}│ ${lockDisplay} │${Fmt.reset}`);
        });
        console.log(`${Fmt.red}└────┴────────┴──────────────────────┴────────────────────┴──────────────────────────┘${Fmt.reset}\n`);
    } else {
        console.log(centerText(`  ${Fmt.gray}[ ѕᴛᴏʀᴀɢᴇ ᴇᴍᴘᴛʏ. ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟɪɴᴋᴇᴅ ʏᴇᴛ ]${Fmt.reset}\n`));
    }
}

async function homeMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴍᴀɪɴ ᴄᴏʀᴇ');
    if (notification) console.log(centerText(` ${Fmt.bgRed}${Fmt.white}${Fmt.bold} ᴀʟᴇʀᴛ ${Fmt.reset} ${Fmt.red}${notification}${Fmt.reset}\n`));

    const menuIndent = "                 ";
    console.log(`${menuIndent}${Fmt.red}1.│${Fmt.reset} ${Fmt.bold}ʀᴜɴ ᴍᴜʟᴛɪ-ᴀᴄᴄᴏᴜɴᴛ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ (ᴀᴜᴛᴏᴍᴀᴛᴇᴅ ᴄʏᴄʟᴇ)${Fmt.reset}`);
    console.log(`${menuIndent}${Fmt.red}2.│${Fmt.reset} ${Fmt.bold}ᴍᴀɴᴀɢᴇ ѕᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛѕ ᴠᴀᴜʟᴛ${Fmt.reset}`);
    console.log('\n' + centerText(Fmt.gray + 'ᴘʀᴇѕѕ ᴄᴛʀʟ + ᴄ ᴛᴏ ᴇхɪᴛ.' + Fmt.reset) + '\n');

    const decision = await ask(centerText(`${Fmt.bold}${Fmt.red}>> ѕᴇʟᴇᴄᴛ ᴘᴀᴛʜ: ${Fmt.reset}`).trim() + ' ');
    if (decision === '1') return autoRunMultiAPI();
    if (decision === '2') return profilesMenu();
    homeMenu();
}

async function profilesMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴀᴄᴄᴏᴜɴᴛѕ ᴠᴀᴜʟᴛ');
    if (notification) console.log(centerText(` ${Fmt.bgRed}${Fmt.white}${Fmt.bold} ѕᴛᴀᴛᴇ ${Fmt.reset} ${Fmt.yellow}${notification}${Fmt.reset}\n`));

    let profilesWithStatus = [];
    let locksMap = {};
    try {
        const rows = await db_all('SELECT id, username, steamId, cookies, last_comment FROM steamprofiles');
        const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
        currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

        if (rows.length > 0) {
            process.stdout.write(centerText(`${Fmt.dim}ᴠᴀʟɪᴅᴀᴛɪɴɢ ᴄᴏᴏᴋɪᴇѕ, ᴘʟᴇᴀѕᴇ ᴡᴀɪᴛ...${Fmt.reset}`) + '\r');
            
            profilesWithStatus = await Promise.all(rows.map(async (row, i) => {
                const tempCommunity = new SteamCommunity();
                let isValid = false;
                try {
                    if (row.cookies) {
                        tempCommunity.setCookies(JSON.parse(row.cookies));
                        isValid = await new Promise(resolve => tempCommunity.loggedIn((err, li) => resolve(!err && li)));
                    }
                } catch (e) { isValid = false; }
                const letter = String.fromCharCode(97 + i); 
                return { ...row, letterId: letter, displayLetter: est(letter), isValid };
            }));

            printAccountsTable(profilesWithStatus, locksMap);
        } else {
            console.log(centerText(`  ${Fmt.gray}[ ѕᴛᴏʀᴀɢᴇ ᴇᴍᴘᴛʏ. ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟɪɴᴋᴇᴅ ʏᴇᴛ ]${Fmt.reset}\n`));
        }
    } catch (e) {
        console.log(centerText(`  ${Fmt.red}❌ ᴇʀʀᴏʀ ʀᴇᴀᴅɪɴɢ ᴅᴀᴛᴀʙᴀѕᴇ.${Fmt.reset}`));
    }

    const menuIndent = "                 ";
    console.log(`${menuIndent}${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}`);
    console.log(`${menuIndent}${Fmt.red}1.│${Fmt.reset} ʟɪɴᴋ ɴᴇᴡ ѕᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛ ᴠɪᴀ ɪɴᴄᴏɢɴɪᴛᴏ ʙʀᴏᴡѕᴇʀ`);
    console.log(`${menuIndent}${Fmt.red}2.│${Fmt.reset} ᴅᴇʟᴇᴛᴇ ᴀɴ ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴄᴏʀᴅ`);
    console.log(`${menuIndent}${Fmt.red}3.│${Fmt.reset} ᴜɴʟᴏᴄᴋ ᴀ ʀᴇѕᴛʀɪᴄᴛᴇᴅ ᴀᴄᴄᴏᴜɴᴛ`);
    console.log(`${menuIndent}${Fmt.red}4.│${Fmt.reset} ᴛᴏɢɢʟᴇ ᴅᴇʙᴜɢ ᴍᴏᴅᴇ [${debugMode ? Fmt.green + 'ᴇɴᴀʙʟᴇᴅ' : Fmt.red + 'ᴅɪѕᴀʙʟᴇᴅ'}${Fmt.reset}]\n`);

    const decision = await ask(centerText(`${Fmt.bold}${Fmt.red}>> ѕᴇʟᴇᴄᴛ ᴏᴘᴛɪᴏɴ: ${Fmt.reset}`).trim() + ' ');
    
    if (decision === '0') return homeMenu();

    const selectedProfile = profilesWithStatus.find(p => p.letterId === decision.toLowerCase());
    if (selectedProfile) {
        await renewAccountCookies(selectedProfile);
        return profilesMenu('ᴄᴏᴏᴋɪᴇ ᴘʀᴏᴄᴇѕѕɪɴɢ ᴄᴏᴍᴘʟᴇᴛᴇᴅ.');
    }

    if (decision === '1') return addAccountViaBrowserWindow();
    if (decision === '2') return removeSteamAccount(profilesWithStatus);
    if (decision === '3') return unlockSteamAccount(profilesWithStatus);
    if (decision === '4') {
        debugMode = !debugMode;
        return profilesMenu(`ᴅᴇʙᴜɢ ᴍᴏᴅᴇ ѕᴇᴛ ᴛᴏ ${debugMode ? 'ᴇɴᴀʙʟᴇᴅ' : 'ᴅɪѕᴀʙʟᴇᴅ'}.`);
    }
    profilesMenu();
}

async function unlockSteamAccount(profiles) {
    displayHeader('ᴜɴʟᴏᴄᴋ ᴀᴄᴄᴏᴜɴᴛѕ');
    if (profiles.length === 0) return profilesMenu('ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟᴏᴀᴅᴇᴅ ᴛᴏ ᴜɴʟᴏᴄᴋ.');
    
    const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
    const locksMap = {};
    currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

    printAccountsTable(profiles, locksMap);
    console.log(centerText(`${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}\n`));

    const selection = await ask(centerText(`${Fmt.bold}${Fmt.red}>> ᴇɴᴛᴇʀ ᴀᴄᴄᴏᴜɴᴛ ɪᴅ ʟᴇᴛᴛᴇʀ ᴏʀ 0: ${Fmt.reset}`).trim() + ' ');
    if (selection === '0') return homeMenu();

    const target = profiles.find(p => p.letterId === selection.toLowerCase());
    if (target) {
        db.run(`DELETE FROM account_locks WHERE steamId = ?`, [target.steamId], (err) => {
            if (err) return profilesMenu('ᴇʀʀᴏʀ ᴄʟᴇᴀʀɪɴɢ ʀᴇѕᴛʀɪᴄᴛɪᴏɴ.');
            profilesMenu(`ᴀᴄᴄᴏᴜɴᴛ [${est(target.username)}] ɪѕ ɴᴏᴡ ᴜɴʟᴏᴄᴋᴇᴅ.`);
        });
    } else {
        profilesMenu('ɪᴅ ɴᴏᴛ ᴅᴇᴛᴇᴄᴛᴇᴅ.');
    }
}

async function addAccountViaBrowserWindow() {
    displayHeader('ʟɪɴᴋ ᴀᴄᴄᴏᴜɴᴛ ᴠɪᴀ ʙʀᴏᴡѕᴇʀ');
    renderBox("ᴍᴜʟᴛɪ-ᴀᴄᴄᴏᴜɴᴛ ʀᴇɢɪѕᴛʀᴀᴛɪᴏɴ", 
        "1. ᴀ ᴘᴜʀᴇ ʙʀᴏᴡѕᴇʀ ᴡɪɴᴅᴏᴡ ᴡɪʟʟ ᴏᴘᴇɴ ɪɴ ɪɴᴄᴏɢɴɪᴛᴏ ᴍᴏᴅᴇ.\n" +
        "2. ʟᴏɢ ɪɴᴛᴏ ᴛʜᴇ ѕᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ ѕᴀᴠᴇ.\n" +
        "3. ʟᴏɢɪɴ ᴄᴏᴍᴘʟᴇᴛᴇ, ᴅᴀᴛᴀ ѕᴀᴠᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ.", 
        Fmt.red
    );

    const menuIndent = "                          ";
    console.log('\n' + `${menuIndent}${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}`);
    console.log(`${menuIndent}${Fmt.red}1.│${Fmt.reset} ʟᴀᴜɴᴄʜ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ʙʀᴏᴡѕᴇʀ\n`);

    const choice = await ask(centerText(`${Fmt.bold}${Fmt.red}>> ѕᴇʟᴇᴄᴛ ᴀᴄᴛɪᴏɴ: ${Fmt.reset}`).trim() + ' ');
    if (choice === '0') return homeMenu();
    if (choice !== '1') return addAccountViaBrowserWindow();

    console.log('\n' + centerText(`${Fmt.dim}ʟᴀᴜɴᴄʜɪɴɢ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ʙʀᴏᴡѕᴇʀ ɪɴѕᴛᴀɴᴄᴇ...${Fmt.reset}\n`));

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        console.log(centerText(`${Fmt.red}🔄 ᴍᴏɴɪᴛᴏʀɪɴɢ ʟᴏɢɪɴ ѕᴛᴀᴛᴇ... ᴄᴏᴍᴘʟᴇᴛᴇ ᴛʜᴇ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ɪɴ ᴛʜᴇ ʙʀᴏᴡѕᴇʀ.${Fmt.reset}`));

        let cookies = [];
        let loggedIn = false;
        let steamId64 = null;

        while (!loggedIn) {
            try {
                const currentCookies = await page.cookies();
                const hasSession = currentCookies.some(c => c.name === 'sessionid');
                const hasSecure = currentCookies.some(c => c.name === 'steamLoginSecure');

                if (hasSession && hasSecure) {
                    cookies = currentCookies.map(c => `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`);
                    const secureCookie = currentCookies.find(c => c.name === 'steamLoginSecure');
                    if (secureCookie) {
                        const match = secureCookie.value.match(/^(\d+)/);
                        if (match) steamId64 = match[1];
                    }
                    loggedIn = true;
                    break;
                }
            } catch (e) { break; }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (loggedIn && steamId64) {
            console.log('\n' + centerText(`${Fmt.green}✓ ѕᴇѕѕɪᴏɴ ѕᴛᴏʀᴇᴅ: ${steamId64}${Fmt.reset}`));
            await page.goto('https://steamcommunity.com/my/', { waitUntil: 'domcontentloaded' });
            
            let rawName = `ѕᴛᴇᴀᴍ_${steamId64.substring(0, 6)}`;
            try {
                const nameEl = await page.$('.actual_persona_name');
                if(nameEl) rawName = await page.evaluate(el => el.innerText, nameEl);
            } catch(e) {}
            
            const accountName = est(rawName);
            console.log(centerText(`${Fmt.green}✓ ᴜѕᴇʀ ѕᴀᴠᴇᴅ: ${accountName}${Fmt.reset}`));
            await browser.close();

            db.run(`INSERT OR REPLACE INTO steamprofiles (username, steamId, cookies, token) VALUES (?, ?, ?, ?)`, 
                [accountName, steamId64, JSON.stringify(cookies), 'API_Auth_Session'], (dbErr) => {
                    if (dbErr) {
                        renderBox("ᴅʙ ᴡʀɪᴛᴇ ᴇʀʀᴏʀ", dbErr.message, Fmt.red);
                        setTimeout(() => profilesMenu(), 4000);
                        return;
                    }
                    profilesMenu(`ᴀᴄᴄᴏᴜɴᴛ ᴀᴅᴅᴇᴅ ᴀɴᴅ ѕᴇᴄᴜʀᴇᴅ ɪɴ ѕᴛᴏʀᴀɢᴇ!`);
                }
            );
        } else {
            if (browser) await browser.close();
            profilesMenu('ᴘʀᴏᴄᴇѕѕ ᴀʙᴏʀᴛᴇᴅ ᴏʀ ᴡɪɴᴅᴏᴡ ᴄʟᴏѕᴇᴅ.');
        }
    } catch (err) {
        if (browser) await browser.close().catch(() => {});
        profilesMenu(`Aʟʟᴏᴄᴀᴛɪᴏɴ ᴇʀʀᴏʀ: ${err.message}`);
    }
}

async function removeSteamAccount(profiles) {
    displayHeader('ᴅᴇʟᴇᴛᴇ ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴄᴏʀᴅ');
    if (profiles.length === 0) return profilesMenu('ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟᴏᴀᴅᴇᴅ ᴛᴏ ᴅᴇʟᴇᴛᴇ.');

    const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
    const locksMap = {};
    currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

    printAccountsTable(profiles, locksMap);
    console.log(centerText(`${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}\n`));

    const accountTarget = await ask(centerText(`🗑️ ${Fmt.bold}ᴇɴᴛᴇʀ ᴜѕᴇʀɴᴀᴍᴇ, ѕᴛᴇᴀᴍ ɪᴅ ᴏʀ 0: ${Fmt.reset}`).trim() + ' ');
    if (accountTarget === '0') return homeMenu();

    const target = profiles.find(p => p.letterId === accountTarget.toLowerCase() || p.username.toLowerCase() === accountTarget.toLowerCase() || p.steamId === accountTarget);
    const queryId = target ? target.steamId : accountTarget;

    db.run(`DELETE FROM steamprofiles WHERE steamId = ? OR username = ?`, [queryId, queryId], () => {
        db.run(`DELETE FROM account_locks WHERE steamId = ?`, [queryId], () => {
            profilesMenu('ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴍᴏᴠᴇᴅ ᴄʟᴇᴀɴʟʏ.');
        });
    });
}

function db_all(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function renewAccountCookies(steamAccount) {
    renderBox("ᴄᴏᴏᴋɪᴇ ᴀᴜᴛᴏ-ʀᴇɴᴇᴡᴀʟ ᴘɪᴘᴇʟɪɴᴇ", `ᴛᴀʀɢᴇᴛ ᴜѕᴇʀ: ${est(steamAccount.username)}\nᴘʟᴇᴀѕᴇ ʟᴏɢ ɪɴ ᴛᴏ ᴛʜɪѕ ᴀᴄᴄᴏᴜɴᴛ ɪɴ ᴛʜᴇ ʙʀᴏᴡѕᴇʀ...`, Fmt.red);
    
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        let cookies = [];
        let loggedIn = false;
        let matchedOriginalTarget = false;

        while (!loggedIn) {
            try {
                const currentCookies = await page.cookies();
                const hasSession = currentCookies.some(c => c.name === 'sessionid');
                const hasSecure = currentCookies.some(c => c.name === 'steamLoginSecure');

                if (hasSession && hasSecure) {
                    const secureCookie = currentCookies.find(c => c.name === 'steamLoginSecure');
                    let currentSteamId = null;
                    if (secureCookie) {
                        const match = secureCookie.value.match(/^(\d+)/);
                        if (match) currentSteamId = match[1];
                    }

                    cookies = currentCookies.map(c => `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`);

                    if (currentSteamId && currentSteamId !== steamAccount.steamId) {
                        console.log('\n' + centerText(`${Fmt.yellow}⚠️ [ᴀᴜᴛᴏ-ᴅᴇᴛᴇᴄᴛ] ᴅɪꜰꜰᴇʀᴇɴᴛ ᴀᴄᴄᴏᴜɴᴛ ᴅᴇᴛᴇᴄᴛᴇᴅ (${currentSteamId}). ʀᴇ-ʀᴏᴜᴛɪɴɢ...${Fmt.reset}`));
                        await page.goto('https://steamcommunity.com/my/', { waitUntil: 'domcontentloaded' });
                        let rawName = `ѕᴛᴇᴀᴍ_${currentSteamId.substring(0, 6)}`;
                        try {
                            const nameEl = await page.$('.actual_persona_name');
                            if (nameEl) rawName = await page.evaluate(el => el.innerText, nameEl);
                        } catch(e) {}
                        const accountName = est(rawName);

                        await new Promise((res) => {
                            db.run(`INSERT OR REPLACE INTO steamprofiles (username, steamId, cookies, token) VALUES (?, ?, ?, ?)`, 
                                [accountName, currentSteamId, JSON.stringify(cookies), 'API_Auth_Session'], () => res());
                        });
                        console.log(centerText(`${Fmt.green}✓ [ᴀʟʟᴏᴄᴀᴛᴇᴅ] ᴄᴏᴏᴋɪᴇѕ ᴀᴜᴛᴏ-ᴀѕѕɪɢɴᴇᴅ ᴛᴏ ᴘʀᴏꜰɪʟᴇ: ${accountName}${Fmt.reset}\n`));
                        matchedOriginalTarget = false;
                    } else {
                        db.run(`UPDATE steamprofiles SET cookies = ? WHERE steamId = ?`, [JSON.stringify(cookies), steamAccount.steamId]);
                        console.log('\n' + centerText(`${Fmt.green}✓ [ᴠᴀʟɪᴅᴀᴛᴇᴅ] ᴄᴏᴏᴋɪᴇѕ ᴜᴘᴅᴀᴛᴇᴅ ꜰᴏʀ ᴛᴀʀɢᴇᴛ: ${est(steamAccount.username)}${Fmt.reset}\n`));
                        matchedOriginalTarget = true;
                    }
                    loggedIn = true;
                    break;
                }
            } catch (e) { break; }
            await new Promise(r => setTimeout(r, 1000));
        }

        await browser.close();
        return matchedOriginalTarget ? cookies : null;
    } catch (err) {
        console.log(centerText(`${Fmt.red}❌ ᴇʀʀᴏʀ ᴅᴜʀɪɴɢ ʙʀᴏᴡѕᴇʀ ᴀᴜᴛᴏ-ʀᴇᴛʀʏ: ${err.message}${Fmt.reset}`));
        if (browser) await browser.close().catch(() => {});
        return null;
    }
}

// --- ENGINE PIPELINE SYSTEM (EXECUTIVE RUN CYCLE) ---
async function autoRunMultiAPI() {
    try {
        displayHeader('ᴘᴜʀᴇ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ ᴘʀᴏᴄᴇѕѕɪɴɢ');
        
        const response = await fetch(`https://rep4rep.com/pub-api/user/steamprofiles?apiToken=${config.apiToken}`);
        const data = await response.json();
        
        if (data.error) {
            await new Promise(r => setTimeout(r, 5000));
            return homeMenu();
        }

        let repSteamProfiles = [];
        let repSteamProfilesObj = {};
        data.forEach((p) => {
            repSteamProfiles.push(p.steamId);
            repSteamProfilesObj[p.steamId] = p.id; 
        });

        const steamProfiles = await db_all('SELECT id, username, steamId, cookies, token FROM steamprofiles');
        process.stdout.write(`\x1b]0;ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ │ ${steamProfiles.length} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);

        if (steamProfiles.length === 0) {
            await new Promise(r => setTimeout(r, 5000));
            return homeMenu();
        }

        const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
        const locksMap = {};
        currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

        const formattedProfiles = steamProfiles.map((p, i) => ({
            ...p,
            displayLetter: est(String.fromCharCode(97 + i))
        }));

        printAccountsTable(formattedProfiles, locksMap);

        let totalTasksProcessedInCycle = 0;
        let nearestUnlockTime = Infinity;

        if (debugMode) {
            console.log(centerText(`${Fmt.bold}${Fmt.red}─ ᴀᴄᴛɪᴠᴇ ᴅᴇʙᴜɢ ᴇхᴇᴄᴜᴛɪᴏɴ ʟɪѕᴛ ─${Fmt.reset}\n`));
        }

        for (const steamProfile of steamProfiles) {
            const lockTime = locksMap[steamProfile.steamId] || 0;
            const nowTime = Date.now();

            if (lockTime > nowTime) {
                const remainingSeconds = Math.ceil((lockTime - nowTime) / 1000);
                if (lockTime < nearestUnlockTime) nearestUnlockTime = lockTime;
                continue;
            }

            try {
                if (!repSteamProfiles.includes(steamProfile.steamId)) {
                    const bodyParams = new URLSearchParams({ apiToken: config.apiToken, steamProfile: steamProfile.steamId });
                    await fetch('https://rep4rep.com/pub-api/user/steamprofiles/add', { method: 'POST', body: bodyParams });
                    
                    const refRes = await fetch(`https://rep4rep.com/pub-api/user/steamprofiles?apiToken=${config.apiToken}`);
                    const refData = await refRes.json();
                    if (!refData.error) {
                        refData.forEach(p => {
                            if (!repSteamProfiles.includes(p.steamId)) repSteamProfiles.push(p.steamId);
                            repSteamProfilesObj[p.steamId] = p.id;
                        });
                    }
                }

                if (!debugMode) {
                    renderBox("ᴀᴄᴛɪᴠᴇ ѕᴛʀᴇᴀᴍ ᴛᴀʀɢᴇᴛ", `ᴘʀᴏᴄᴇѕѕɪɴɢ ᴀᴘɪ ʟᴏᴏᴘѕ ᴏɴ ᴀᴄᴄᴏᴜɴᴛ: ${est(steamProfile.username)}`, Fmt.red);
                }
                
                let currentCookiesString = steamProfile.cookies;
                community.setCookies(JSON.parse(currentCookiesString));
                
                let loggedIn = await new Promise((r) => community.loggedIn((err, li) => r(!err && li)));
                
                if (!loggedIn) {
                    console.log(centerText(`${Fmt.red}❌ ѕᴇѕѕɪᴏɴ <b>ᴄᴏᴏᴋɪᴇѕ</b> ᴇхᴘɪʀᴇᴅ ᴏɴ ${est(steamProfile.username)}. ʀᴇʙᴏᴏᴛɪɴɢ...${Fmt.reset}`));
                    const renewedCookies = await renewAccountCookies(steamProfile);
                    if (renewedCookies) {
                        community.setCookies(renewedCookies);
                        loggedIn = true; 
                    } else {
                        continue;
                    }
                }

                let keepUsingAccount = true;

                while (keepUsingAccount) {
                    const tasksRes = await fetch(`https://rep4rep.com/pub-api/tasks?apiToken=${config.apiToken}&steamProfile=${repSteamProfilesObj[steamProfile.steamId]}`);
                    const tasks = await tasksRes.json();
                    
                    if (tasks.error || tasks.length === 0) {
                        keepUsingAccount = false;
                        break;
                    }

                    const currentBatch = tasks.slice(0, 3);
                    let accountRateLimited = false;

                    for (const task of currentBatch) {
                        try {
                            await new Promise((res, rejectSession) => {
                                community.postUserComment(task.targetSteamProfileId, task.requiredCommentText, (e) => {
                                    if (e) return rejectSession(e);
                                    res();
                                });
                            });

                            const completeParams = new URLSearchParams({
                                apiToken: config.apiToken, taskId: task.taskId,
                                commentId: task.requiredCommentId, authorSteamProfileId: repSteamProfilesObj[steamProfile.steamId]
                            });
                            
                            const r4rRes = await fetch('https://rep4rep.com/pub-api/tasks/complete', { method: 'POST', body: completeParams });
                            const r4rData = await r4rRes.json();

                            if (!r4rData.error) {
                                if (debugMode) {
                                    console.log(`  ${Fmt.red}➔${Fmt.reset} [${Fmt.red}<b>ᴄᴏᴍᴘʟᴇᴛᴇᴅ</b>${Fmt.reset}] ᴄᴏᴍᴍᴇɴᴛ sʏɴᴄᴇᴅ sᴜᴄᴄᴇssꜰᴜʟʟʏ │ ${Fmt.gray}${est(steamProfile.username)}${Fmt.reset}`);
                                }
                                totalTasksProcessedInCycle++;
                                db.run(`UPDATE steamprofiles SET last_comment = ? WHERE steamId = ?`, [task.requiredCommentText, steamProfile.steamId]);
                            }

                            await new Promise(r => setTimeout(r, 15000));

                        } catch (steamError) {
                            const lockExpiryISO = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
                            db.run(`INSERT OR REPLACE INTO account_locks (steamId, lock_until) VALUES (?, ?)`, [steamProfile.steamId, lockExpiryISO]);
                            accountRateLimited = true;
                            keepUsingAccount = false; 
                            break; 
                        }
                    }

                    if (!accountRateLimited && keepUsingAccount) {
                        if (debugMode) {
                            console.log(`  ${Fmt.red}➔${Fmt.reset} [${Fmt.bold}${Fmt.red}⚡ ᴅɪʀᴇᴄᴛ ᴛʜʀᴇᴀᴅ${Fmt.reset}] ʙᴀᴛᴄʜ sᴇǫᴜᴇɴᴄᴇ ꜰɪɴɪsʜᴇᴅ.`);
                        }
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }

            } catch (profileException) { /* Quiet catch */ }
        }

        console.log('\n' + centerText(`${Fmt.red}🔄 ʀᴇᴛᴜʀɴɪɴɢ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ ɪɴ 5 ѕᴇᴄᴏɴᴅѕ...${Fmt.reset}`));
        await new Promise(r => setTimeout(r, 5000));
        return homeMenu();

    } catch (globalError) {
        await new Promise(r => setTimeout(r, 5000));
        return homeMenu();
    }
}
