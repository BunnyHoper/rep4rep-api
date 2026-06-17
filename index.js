const readLine = require('readline');
const sqlite3 = require('sqlite3').verbose();
const SteamCommunity = require('steamcommunity');
const puppeteer = require('puppeteer');

const community = new SteamCommunity();
const config = require('./config.json');
const { version } = require('./package.json');

// GLOBAL CONFIGURATION STATE
let debugMode = false;

const Fmt = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m",
    gray: "\x1b[90m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", 
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
    bgBlue: "\x1b[44m", bgMagenta: "\x1b[45m"
};

const rl = readLine.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// ᴀᴇѕᴛʜᴇᴛɪᴄ ᴄᴏɴᴠᴇʀᴛᴇʀ & ѕᴍᴀʀᴛ ѕᴀɴɪᴛɪᴢᴇʀ
const est = (str) => {
    if (!str) return '';
    // Strips out emojis, broken replacement blocks, stars and leaves pure monospaced lettering
    let clean = str.replace(/[^\x20-\x7E]/g, '');
    clean = clean.replace(/\s+/g, ' ').trim();
    if (!clean) return 'ѕᴛᴇᴀᴍ_ᴀᴄᴄᴏᴜɴᴛ';
    
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

function renderBox(title, content, color = Fmt.magenta) {
    const width = 95; 
    const border = "─".repeat(width - 2);
    console.log(`${color}┌${border}┐`);
    console.log(`│ ${Fmt.bold}${title.padEnd(width - 4)}${Fmt.reset}${color} │`);
    console.log(`└${border}┘${Fmt.reset}`);
}

function displayHeader(subtitle = 'ᴅᴀѕʜʙᴏᴀʀᴅ') {
    console.log('\x1Bc');
    console.log(`${Fmt.bold}${Fmt.bgMagenta}${Fmt.white}  📂 ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ  ${Fmt.reset} ${Fmt.dim}ᴠ${version}${Fmt.reset}`);
    console.log(`${Fmt.dim} ᴄᴜʀʀᴇɴᴛ ᴄᴏɴᴛᴇхᴛ: ${Fmt.reset}${Fmt.italic}${Fmt.magenta}${subtitle}${Fmt.reset}\n`);
}

function printAccountsTable(profiles) {
    if (profiles.length > 0) {
        console.log(`${Fmt.bold}${Fmt.magenta} ʀᴇɢɪѕᴛᴇʀᴇᴅ ᴀᴄᴄᴏᴜɴᴛѕ:                             ${Fmt.reset}`);
        console.log(`${Fmt.magenta}┌────┬────────┬──────────────────────┬────────────────────┬──────────────────────────┐${Fmt.reset}`);
        console.log(`${Fmt.magenta}│ ɪᴅ │ ѕᴛᴀᴛᴜѕ │ ᴜѕᴇʀɴᴀᴍᴇ             │ ѕᴛᴇᴀᴍ ɪᴅ           │ ʟᴀѕᴛ ᴄᴏᴍᴍᴇɴᴛ             │${Fmt.reset}`);
        console.log(`${Fmt.magenta}├────┼────────┼──────────────────────┼────────────────────┼──────────────────────────┤${Fmt.reset}`);
        
        profiles.forEach(p => {
            const idStr = pad(p.displayLetter, 2);
            const statusIcon = p.isValid ? `${Fmt.green}   ✓    ${Fmt.magenta}` : `${Fmt.red}   х    ${Fmt.magenta}`;
            const uName = pad(est(p.username || ''), 20);
            const sId = pad((p.steamId || ''), 18);
            const lComm = pad(est(p.last_comment || 'ɴᴜʟʟ'), 24);

            console.log(`${Fmt.magenta}│ ${Fmt.cyan}${idStr} ${Fmt.magenta}│${statusIcon}│ ${Fmt.white}${uName} ${Fmt.magenta}│ ${Fmt.gray}${sId} ${Fmt.magenta}│ ${Fmt.dim}${lComm} ${Fmt.magenta}│${Fmt.reset}`);
        });
        console.log(`${Fmt.magenta}└────┴────────┴──────────────────────┴────────────────────┴──────────────────────────┘${Fmt.reset}\n`);
    } else {
        console.log(`  ${Fmt.gray}[ ѕᴛᴏʀᴀɢᴇ ᴇᴍᴘᴛʏ. ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟɪɴᴋᴇᴅ ʏᴇᴛ ]${Fmt.reset}\n`);
    }
}

async function homeMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴍᴀɪɴ ᴄᴏʀᴇ');
    if (notification) console.log(` ${Fmt.bgMagenta}${Fmt.white}${Fmt.bold} ᴀʟᴇʀᴛ ${Fmt.reset} ${Fmt.magenta}${notification}${Fmt.reset}\n`);

    console.log(`  ${Fmt.magenta}1.│${Fmt.reset} ${Fmt.bold}ʀᴜɴ ᴍᴜʟᴛɪ-ᴀᴄᴄᴏᴜɴᴛ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ (ᴀᴜᴛᴏᴍᴀᴛᴇᴅ ᴄʏᴄʟᴇ)${Fmt.reset}`);
    console.log(`  ${Fmt.magenta}2.│${Fmt.reset} ${Fmt.bold}ᴍᴀɴᴀɢᴇ ѕᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛѕ ᴠᴀᴜʟᴛ ${Fmt.reset}`);
    console.log('\n  ' + Fmt.gray + 'ᴘʀᴇѕѕ ᴄᴛʀʟ + ᴄ ᴛᴏ ᴇхɪᴛ.' + Fmt.reset + '\n');

    const decision = await ask(`${Fmt.bold}${Fmt.magenta}>> ѕᴇʟᴇᴄᴛ ᴘᴀᴛʜ: ${Fmt.reset}`);
    if (decision === '1') return autoRunMultiAPI();
    if (decision === '2') return profilesMenu();
    homeMenu();
}

async function profilesMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴀᴄᴄᴏᴜɴᴛѕ ᴠᴀᴜʟᴛ');
    if (notification) console.log(` ${Fmt.bgMagenta}${Fmt.white}${Fmt.bold} ѕᴛᴀᴛᴇ ${Fmt.reset} ${Fmt.yellow}${notification}${Fmt.reset}\n`);

    let profilesWithStatus = [];
    try {
        const rows = await db_all('SELECT id, username, steamId, cookies, last_comment FROM steamprofiles');
        if (rows.length > 0) {
            process.stdout.write(`  ${Fmt.dim}ᴠᴀʟɪ查ᴅᴀᴛɪɴɢ ᴄᴏᴏᴋɪᴇѕ, ᴘʟᴇᴀѕᴇ ᴡᴀɪᴛ...${Fmt.reset}\r`);
            
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

            printAccountsTable(profilesWithStatus);
        } else {
            console.log(`  ${Fmt.gray}[ ѕᴛᴏʀᴀɢᴇ ᴇᴍᴘᴛʏ. ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟɪɴᴋᴇᴅ ʏᴇᴛ ]${Fmt.reset}\n`);
        }
    } catch (e) {
        console.log(`  ${Fmt.red}❌ ᴇʀʀᴏʀ ʀᴇᴀᴅɪɴɢ ᴅᴀᴛᴀʙᴀѕᴇ.${Fmt.reset}`);
    }

    console.log(`  ${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}`);
    console.log(`  ${Fmt.magenta}1.│${Fmt.reset} ʟɪɴᴋ ɴᴇᴡ ѕᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛ ᴠɪᴀ ɪɴᴄᴏɢɴɪᴛᴏ ʙʀᴏᴡѕᴇʀ`);
    console.log(`  ${Fmt.magenta}2.│${Fmt.reset} ᴅᴇʟᴇᴛᴇ ᴀɴ ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴄᴏʀᴅ`);
    console.log(`  ${Fmt.magenta}3.│${Fmt.reset} ᴜɴʟᴏᴄᴋ ᴀ ʀᴇѕᴛʀɪᴄᴛᴇᴅ ᴀᴄᴄᴏᴜɴᴛ`);
    console.log(`  ${Fmt.magenta}4.│${Fmt.reset} ᴛᴏɢɢʟᴇ ᴅᴇʙᴜɢ ᴍᴏᴅᴇ [${debugMode ? Fmt.green + 'ᴇɴᴀʙʟᴇᴅ' : Fmt.red + 'ᴅɪѕᴀʙʟᴇᴅ'}${Fmt.reset}]\n`);

    const decision = await ask(`${Fmt.bold}${Fmt.magenta}>> ѕᴇʟᴇᴄᴛ ᴏᴘᴛɪᴏɴ (ᴏʀ ᴛʏᴘᴇ ɪᴅ ʟᴇᴛᴛᴇʀ ᴛᴏ ʀᴇɴᴇᴡ ʙʀᴏᴋᴇɴ ᴄᴏᴏᴋɪᴇ): ${Fmt.reset}`);
    
    if (decision === '0') return homeMenu();

    const selectedProfile = profilesWithStatus.find(p => p.letterId === decision.toLowerCase());
    if (selectedProfile) {
        if (!selectedProfile.isValid) {
            await renewAccountCookies(selectedProfile);
            return profilesMenu('ᴄᴏᴏᴋɪᴇ ᴜᴘᴅᴀᴛᴇ ᴄᴏᴍᴘʟᴇᴛᴇᴅ.');
        } else {
            return profilesMenu('ᴛʜᴀᴛ ᴀᴄᴄᴏᴜɴᴛ ɪѕ ᴀʟʀᴇᴀᴅʏ ᴠᴀʟɪᴅ, ᴀᴄᴛɪᴏɴ ᴅᴇɴɪᴇᴅ.');
        }
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
    
    printAccountsTable(profiles);

    console.log(`  ${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}\n`);

    const selection = await ask(`${Fmt.bold}${Fmt.magenta}>> ᴇɴᴛᴇʀ ᴀᴄᴄᴏᴜɴᴛ ɪᴅ ʟᴇᴛᴛᴇʀ ᴛᴏ ᴜɴʟᴏᴄᴋ ᴏʀ 0 ꜰᴏʀ ᴍᴀɪɴ ᴍᴇɴᴜ: ${Fmt.reset}`);
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
        Fmt.magenta
    );

    console.log(`  ${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}`);
    console.log(`  ${Fmt.magenta}1.│${Fmt.reset} ʟᴀᴜɴᴄʜ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ʙʀᴏᴡѕᴇʀ\n`);

    const choice = await ask(`${Fmt.bold}${Fmt.magenta}>> ѕᴇʟᴇᴄᴛ ᴀᴄᴛɪᴏɴ: ${Fmt.reset}`);
    if (choice === '0') return homeMenu();
    if (choice !== '1') return addAccountViaBrowserWindow();

    console.log(`\n${Fmt.dim}ʟᴀᴜɴᴄʜɪɴɢ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ʙʀᴏᴡѕᴇʀ ɪɴѕᴛᴀɴᴄᴇ...${Fmt.reset}\n`);

    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        console.log(`${Fmt.magenta}🔄 ᴍᴏɴɪᴛᴏʀɪɴɢ ʟᴏɢɪɴ ѕᴛᴀᴛᴇ... ᴄᴏᴍᴘʟᴇᴛᴇ ᴛʜᴇ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ɪɴ ᴛʜᴇ ʙʀᴏᴡѕᴇʀ.${Fmt.reset}`);

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
            } catch (e) {
                break; 
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        if (loggedIn && steamId64) {
            console.log(`\n${Fmt.green}✓ ѕᴇѕѕɪᴏɴ ѕᴛᴏʀᴇᴅ: ${steamId64}${Fmt.reset}`);
            
            console.log(`${Fmt.magenta}🔄 ᴇхᴛʀᴀᴄᴛɪɴɢ ᴜѕᴇʀ ᴅᴀᴛᴀ...${Fmt.reset}`);
            await page.goto('https://steamcommunity.com/my/', { waitUntil: 'domcontentloaded' });
            
            let rawName = `ѕᴛᴇᴀᴍ_${steamId64.substring(0, 6)}`;
            try {
                const nameEl = await page.$('.actual_persona_name');
                if(nameEl) {
                    rawName = await page.evaluate(el => el.innerText, nameEl);
                }
            } catch(e) {}
            
            const accountName = est(rawName);
            console.log(`${Fmt.green}✓ ᴜѕᴇʀ ѕᴀᴠᴇᴅ: ${accountName}${Fmt.reset}`);

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
            await browser.close();
            profilesMenu('ᴘʀᴏᴄᴇѕѕ ᴀʙᴏʀᴛᴇᴅ ᴏʀ ᴡɪɴᴅᴏᴡ ᴄʟᴏѕᴇᴅ.');
        }
    } catch (err) {
        profilesMenu(`ᴀʟʟᴏᴄᴀᴛɪᴏɴ ᴇʀʀᴏʀ: ${err.message}`);
    }
}

async function removeSteamAccount(profiles) {
    displayHeader('ᴅᴇʟᴇᴛᴇ ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴄᴏʀᴅ');
    if (profiles.length === 0) return profilesMenu('ɴᴏ ᴀᴄᴄᴏᴜɴᴛѕ ʟᴏᴀᴅᴇᴅ ᴛᴏ ᴅᴇʟᴇᴛᴇ.');

    printAccountsTable(profiles);

    console.log(`  ${Fmt.gray}0.│ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}\n`);

    const accountTarget = await ask(`🗑️ ${Fmt.bold}ᴇɴᴛᴇʀ ᴜѕᴇʀɴᴀᴍᴇ, ѕᴛᴇᴀᴍ ɪᴅ ᴏʀ 0 ꜰᴏʀ ᴍᴀɪɴ ᴍᴇɴᴜ: ${Fmt.reset}`);
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

// --- AUTOMATIC INCOGNITO COOKIE RENEWAL SYSTEM ---
async function renewAccountCookies(steamAccount) {
    renderBox("ᴄᴏᴏᴋɪᴇ ᴀᴜᴛᴏ-ʀᴇɴᴇᴡᴀʟ ᴘɪᴘᴇʟɪɴᴇ", `ᴛᴀʀɢᴇᴛ ᴜѕᴇʀ: ${est(steamAccount.username)}\nᴘʟᴇᴀѕᴇ ʟᴏɢ ɪɴ ᴛᴏ ᴛʜɪѕ ᴇхᴀᴄᴛ ᴀᴄᴄᴏᴜɴᴛ ɪɴ ᴛʜᴇ ʙʀᴏᴡѕᴇʀ...`, Fmt.magenta);
    
    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        let cookies = [];
        let loggedIn = false;

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

                    if (currentSteamId && currentSteamId !== steamAccount.steamId) {
                        console.log(`\n  ${Fmt.red}⚠️ [ᴍɪѕᴍᴀᴛᴄʜ] ʏᴏᴜ ʟᴏɢɢᴇdz ɪɴᴛᴏ ᴛʜᴇ ᴡʀᴏɴɢ ᴀᴄᴄᴏᴜɴᴛ! (${currentSteamId}). ᴘʟᴇᴀѕᴇ ᴜѕᴇ -> ${est(steamAccount.username)}${Fmt.reset}`);
                        await new Promise(r => setTimeout(r, 3000));
                        continue;
                    }

                    cookies = currentCookies.map(c => `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`);
                    loggedIn = true;
                    break;
                }
            } catch (e) {
                break; 
            }
            await new Promise(r => setTimeout(r, 1000));
        }

        await browser.close();

        if (loggedIn) {
            db.run(`UPDATE steamprofiles SET cookies = ? WHERE steamId = ?`, [JSON.stringify(cookies), steamAccount.steamId]);
            console.log(`\n  ${Fmt.green}✓ [ᴠᴀʟɪ點ᴅᴇᴅ] ᴄᴏᴏᴋɪᴇѕ ᴜᴘᴅᴀᴛᴇᴅ ɪɴ ѕᴛᴏʀᴀɢᴇ ᴛᴀʀɢᴇᴛɪɴɢ: ${est(steamAccount.username)}${Fmt.reset}\n`);
            return cookies;
        }
        return null;
    } catch (err) {
        console.log(`  ${Fmt.red}❌ ᴇʀʀᴏʀ ᴅᴜʀɪɴɢ ʙʀᴏᴡѕᴇʀ ᴀᴜᴛᴏ-ʀᴇᴛʀʏ: ${err.message}${Fmt.reset}`);
        return null;
    }
}

// --- ENGINE PIPELINE SYSTEM (EXECUTIVE RUN CYCLE) ---
async function autoRunMultiAPI() {
    try {
        displayHeader('ᴘᴜʀᴇ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ ᴘʀᴏᴄᴇѕѕɪɴɢ');
        
        if (debugMode) console.log(`${Fmt.gray}[ᴀᴘɪ] ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ʟɪɴᴋѕ ᴠɪᴀ ʀᴇᴘ4ʀᴇᴘ ѕᴇʀᴠᴇʀѕ...${Fmt.reset}`);
        const response = await fetch(`https://rep4rep.com/pub-api/user/steamprofiles?apiToken=${config.apiToken}`);
        const data = await response.json();
        
        if (data.error) {
            console.log(`${Fmt.red}[ᴀᴘɪ ᴇʀʀᴏʀ] ѕᴇʀᴠᴇʀ ʀᴇѕᴘᴏɴѕᴇ ᴅʀᴏᴘᴘᴇᴅ: ${data.error}${Fmt.reset}`);
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
            console.log(`${Fmt.yellow}[ᴡᴀʀɴɪɴɢ] ʟᴏᴄᴀʟ ᴠᴀᴜʟᴛ ѕᴛᴏʀᴀɢᴇ ʜᴏʟᴅѕ 0 ᴀᴄᴄᴏᴜɴᴛѕ. ѕᴛᴏᴘ ᴘɪᴘᴇʟɪɴᴇ.${Fmt.reset}`);
            await new Promise(r => setTimeout(r, 5000));
            return homeMenu();
        }

        const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
        const locksMap = {};
        currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

        let totalTasksProcessedInCycle = 0;
        let activeAvailableAccountsCount = 0;
        let nearestUnlockTime = Infinity;

        for (const steamProfile of steamProfiles) {
            const lockTime = locksMap[steamProfile.steamId] || 0;
            const nowTime = Date.now();

            if (lockTime > nowTime) {
                const remainingSeconds = Math.ceil((lockTime - nowTime) / 1000);
                if (lockTime < nearestUnlockTime) nearestUnlockTime = lockTime;
                
                const remainingHours = (remainingSeconds / 3600).toFixed(1);
                console.log(`  ${Fmt.red}ʟᴏᴄᴋᴇᴅ [${est(steamProfile.username)}] ${remainingHours} ʜ.${Fmt.reset}`);
                continue;
            }

            activeAvailableAccountsCount++;

            try {
                if (!repSteamProfiles.includes(steamProfile.steamId)) {
                    if (debugMode) console.log(`[ᴀᴘɪ] ʀᴇɢɪѕᴛᴇʀɪɴɢ ᴀᴄᴄᴏᴜɴᴛ ɪᴅᴇɴᴛɪᴛʏ: ${est(steamProfile.username)}...`);
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

                renderBox("ᴀᴄᴛɪᴠᴇ ѕᴛʀᴇᴀᴍ ᴛᴀʀɢᴇᴛ", `ᴘʀᴏᴄᴇѕѕɪɴɢ ᴀᴘɪ ʟᴏᴏᴘѕ ᴏɴ ᴀᴄᴄᴏᴜɴᴛ: ${est(steamProfile.username)}`, Fmt.magenta);
                
                let currentCookiesString = steamProfile.cookies;
                community.setCookies(JSON.parse(currentCookiesString));
                
                let loggedIn = await new Promise((r) => community.loggedIn((err, li) => r(!err && li)));
                
                if (!loggedIn) {
                    console.log(`  ${Fmt.red}❌ ѕᴇѕѕɪᴏɴ <b>ᴄᴏᴏᴋɪᴇѕ</b> ᴇхᴘɪʀᴇᴅ ᴏɴ ${est(steamProfile.username)}. ɪɴɪᴛɪᴀᴛɪɴɢ ᴀᴜᴛᴏ-ʀᴇʙᴏᴏᴛ...${Fmt.reset}\n`);
                    // FIXED BUG: Changed steamAccount to steamProfile below to avoid runtime reference crashes
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
                        if (debugMode) console.log(`  ${Fmt.gray}[ѕᴄᴀɴɴᴇʀ] ɴᴏ ᴍᴏʀᴇ ᴛᴀѕᴋѕ ᴀᴠᴀɪʟᴀʙʟᴇ ᴏɴ ᴀᴄᴄᴏᴜɴᴛ: ${est(steamProfile.username)}.${Fmt.reset}\n`);
                        keepUsingAccount = false;
                        break;
                    }

                    const currentBatch = tasks.slice(0, 3);
                    if (debugMode) console.log(`${Fmt.gray}  ↳ ǫᴜᴇᴜᴇᴅ ʙᴀᴛᴄʜ ѕᴜʙѕᴇᴛ: [${currentBatch.length}/3] ᴏᴘᴇʀᴀᴛɪᴏɴѕ ᴍᴀᴘᴘᴇᴅ.${Fmt.reset}\n`);

                    let accountRateLimited = false;

                    for (const task of currentBatch) {
                        if (debugMode) {
                            console.log(`  ${Fmt.gray}-> ᴘᴜѕʜɪɴɢ ᴄᴏᴍᴍᴇɴᴛ ᴘᴀʏʟᴏᴀᴅ:${Fmt.reset} ʜᴇᴀᴅɪɴɢ ᴛᴀʀɢᴇᴛ -> ${task.targetSteamProfileName}`);
                        }
                        
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

                            if (r4rData.error) {
                                if (debugMode) console.log(`     ${Fmt.bold}${Fmt.yellow}⚠️ [ʀ4ʀ ʀᴇᴊᴇᴄᴛɪᴏɴ] ${r4rData.error}${Fmt.reset}\n`);
                            } else {
                                if (debugMode) console.log(`     ${Fmt.bold}${Fmt.green}[ᴄᴏᴍᴘʟᴇᴛᴇᴅ] ᴄᴏᴍᴍᴇɴᴛ ѕʏɴᴄᴇᴅ ᴏɴ ʀᴇᴘ4ʀᴇᴘ.${Fmt.reset}\n`);
                                totalTasksProcessedInCycle++;
                                
                                // NEW FIX: Now executing SQLite update directly so last_comment saves cleanly!
                                db.run(`UPDATE steamprofiles SET last_comment = ? WHERE steamId = ?`, [task.requiredCommentText, steamProfile.steamId]);
                            }

                            await new Promise(r => setTimeout(r, 15000));

                        } catch (steamError) {
                            console.log(`     ${Fmt.bold}${Fmt.red}❌ [ѕᴛᴇᴀᴍ ᴄʀɪᴛɪᴄᴀʟ ʀᴇᴊᴇᴄᴛɪᴏɴ] ${steamError.message}${Fmt.reset}`);
                            
                            const lockExpiryISO = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
                            db.run(`INSERT OR REPLACE INTO account_locks (steamId, lock_until) VALUES (?, ?)`, [steamProfile.steamId, lockExpiryISO]);
                            
                            console.log(`\n🚨 ${Fmt.bold}${Fmt.red}[ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ᴀᴄᴛɪᴠᴇ] [${est(steamProfile.username)}] ʟᴏᴄᴋᴇᴅ ꜰᴏʀ 12 ʜᴏᴜʀѕ.${Fmt.reset}\n`);
                            
                            accountRateLimited = true;
                            keepUsingAccount = false; 
                            break; 
                        }
                    }

                    if (!accountRateLimited && keepUsingAccount) {
                        if (debugMode) console.log(`\n${Fmt.bold}${Fmt.green}[⚡ ᴅɪʀᴇᴄᴛ ᴛʜʀᴇᴀᴅ] ʙᴀᴛᴄʜ ᴄᴏᴍᴘʟᴇᴛᴇᴅ.${Fmt.reset}\n`);
                        await new Promise(r => setTimeout(r, 3000));
                    }
                }

            } catch (profileException) {
                console.log(`  ${Fmt.red}❌ [ᴀᴄᴄᴏᴜɴᴛ ɪѕѕᴜᴇ] ${profileException.message}${Fmt.reset}\n`);
            }
        }
        
        if (activeAvailableAccountsCount === 0 && nearestUnlockTime !== Infinity) {
            console.log(`\n${Fmt.bold}${Fmt.red}[ᴀʟʟ ᴀᴄᴄᴏᴜɴᴛѕ ʟᴏᴄᴋᴇᴅ ᴏᴜᴛ] ᴇᴠᴇʀʏ ᴀᴄᴄᴏᴜɴᴛ ɪɴѕɪᴅᴇ ѕᴛᴏʀᴀɢᴇ ɪѕ ᴄᴜʀʀᴇɴᴛʟʏ ʀᴇѕᴛʀɪᴄᴛᴇᴅ.${Fmt.reset}`);
        } else if (totalTasksProcessedInCycle === 0) {
            console.log(`\n${Fmt.gray}[ɴᴏᴛᴇ] ᴀʟʟ ᴀᴄᴛɪᴠᴇ ǫᴜᴇᴜᴇѕ ᴀʀᴇ ᴇᴍᴘᴛʏ.${Fmt.reset}`);
        } else {
            console.log(`\n${Fmt.green}✓ ᴘɪᴘᴇʟɪɴᴇ ᴄʏᴄʟᴇ ᴇхᴇᴄᴜᴛᴇᴅ ѕᴜᴄᴄᴇѕѕꜰᴜʟʟʏ.${Fmt.reset}`);
        }

        console.log(`\n${Fmt.magenta}🔄 ʀᴇᴛᴜʀɴɪɴɢ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ ɪɴ 5 ѕᴇᴄᴏɴᴅѕ...${Fmt.reset}`);
        await new Promise(r => setTimeout(r, 5000));
        return homeMenu();

    } catch (globalError) {
        console.log(`${Fmt.red}[ᴄʀɪᴛɪᴄᴀʟ ᴄᴏʀᴇ ᴇхᴄᴇᴘᴛɪᴏɴ] ɪᴛᴇʀᴀᴛɪᴏɴ ʙʀᴇᴀᴋ: ${globalError.message}${Fmt.reset}`);
        await new Promise(r => setTimeout(r, 5000));
        return homeMenu();
    }
}
