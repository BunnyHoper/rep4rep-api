const readLine = require('readline');
const sqlite3 = require('sqlite3').verbose();
const SteamCommunity = require('steamcommunity');
const puppeteer = require('puppeteer');

const community = new SteamCommunity();
const config = require('./config.json');
const { version } = require('./package.json');

const Fmt = {
    reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m", italic: "\x1b[3m",
    gray: "\x1b[90m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", 
    blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
    bgBlue: "\x1b[44m", bgMagenta: "\x1b[45m"
};

const rl = readLine.createInterface({ input: process.stdin, output: process.stdout });
const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// --- SET INITIAL TITLE ON BOOT IMMEDIATELY ---
process.stdout.write(`\x1b]0;ʀᴇᴘ x ʀᴇᴘ ᴀᴘɪ │ 0 ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);

const db = new sqlite3.Database('./steamprofiles.db', (err) => {
    if (err) process.exit(1);
    initializeSchema();
    // Update title with accurate count immediately upon database readiness
    db.all('SELECT id FROM steamprofiles', [], (dbErr, rows) => {
        const count = rows ? rows.length : 0;
        process.stdout.write(`\x1b]0;ʀᴇᴘ x ʀᴇᴘ ᴀᴘɪ │ ${count} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
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
        process.stdout.write(`\x1b]0;ʀᴇᴘ x ʀᴇᴘ ᴀᴘɪ │ ${rows.length} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
    } catch (e) {
        process.stdout.write(`\x1b]0;ʀᴇᴘ x ʀᴇᴘ ᴀᴘɪ │ 0 ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);
    }
}

function renderBox(title, content, color = Fmt.cyan) {
    const width = 95; 
    const border = "─".repeat(width - 2);
    console.log(`${color}┌${border}┐`);
    console.log(`│ ${Fmt.bold}${title.toUpperCase().padEnd(width - 4)}${Fmt.reset}${color} │`);
    console.log(`├${border}┤${Fmt.reset}`);
    content.split('\n').forEach(line => {
        console.log(`${color}│${Fmt.reset} ${line.padEnd(width - 4)} ${color}│`);
    });
    console.log(`└${border}┘${Fmt.reset}`);
}

// --- UPDATED DISPLAY HEADER SHORTCUT ---
function displayHeader(subtitle = 'ᴅᴀsʜʙᴏᴀʀᴅ') {
    console.log('\x1Bc');
    console.log(`${Fmt.bold}${Fmt.bgMagenta}${Fmt.white}  📂 ʀᴇᴘ х ʀᴇᴘ ᴀᴘɪ  ${Fmt.reset} ${Fmt.dim}v${version}${Fmt.reset}`);
    console.log(`${Fmt.dim} ᴄᴜʀʀᴇɴᴛ ᴄᴏɴᴛᴇxᴛ: ${Fmt.reset}${Fmt.italic}${Fmt.magenta}${subtitle}${Fmt.reset}\n`);
}

async function countdown(seconds, prefix = "⏳ ᴄᴏᴏʟᴅᴏᴡɴ") {
    while (seconds > 0) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        process.stdout.write(`\r     ${Fmt.bold}${Fmt.yellow}${prefix}: ɴᴇxᴛ sʏɴᴄ ᴄʏᴄʟᴇ ʀᴇᴀᴅʏ ɪɴ [${mins}:${secs}]${Fmt.reset} `);
        await new Promise(r => setTimeout(r, 1000));
        seconds--;
    }
    console.log("\n");
}

async function homeMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴍᴀɪɴ ᴄᴏʀᴇ');
    if (notification) console.log(` ${Fmt.bgBlue}${Fmt.white}${Fmt.bold} ᴀᴠɪsᴏ ${Fmt.reset} ${Fmt.cyan}${notification}${Fmt.reset}\n`);

    console.log(`  ${Fmt.magenta}1.│${Fmt.reset} ${Fmt.bold}ʀᴜɴ ᴍᴜʟᴛɪ-ᴀᴄᴄᴏᴜɴᴛ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ (ᴄᴏɴᴛɪɴᴜᴏᴜs ᴀᴜᴛᴏᴍᴀᴛᴇᴅ ʟᴏᴏᴘ)${Fmt.reset}`);
    console.log(`  ${Fmt.magenta}2.│${Fmt.reset} ${Fmt.bold}ᴍᴀɴᴀɢᴇ sᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛs ᴠᴀᴜʟᴛ ${Fmt.gray}(ᴀᴅadd/ his/ᴅᴇʟᴇᴛᴇ ᴀᴄᴄᴏᴜɴᴛs)${Fmt.reset}`);
    console.log('\n  ' + Fmt.gray + 'ᴘʀᴇss ᴄᴛʀʟ + ᴄ ᴛᴏ ᴇxɪᴛ.' + Fmt.reset + '\n');

    const decision = await ask(`${Fmt.bold}${Fmt.magenta}>> sᴇʟᴇᴄᴛ ᴘᴀᴛʜ: ${Fmt.reset}`);
    if (decision === '1') return autoRunMultiAPI();
    if (decision === '2') return profilesMenu();
    homeMenu();
}

async function profilesMenu(notification = false) {
    await updateWindowTitle();
    displayHeader('ᴀᴄᴄᴏᴜɴᴛs ᴠᴀᴜʟᴛ');
    if (notification) console.log(` ${Fmt.bgBlue}${Fmt.white}${Fmt.bold} sᴛᴀᴛᴇ ${Fmt.reset} ${Fmt.yellow}${notification}${Fmt.reset}\n`);

    try {
        const rows = await db_all('SELECT id, username, steamId, last_comment FROM steamprofiles');
        if (rows.length > 0) {
            console.log(`${Fmt.bold}${Fmt.cyan} ʀᴇɢɪsᴛᴇʀᴇᴅ ᴀᴄᴄᴏᴜɴᴛs:${Fmt.reset}`);
            console.table(rows);
        } else {
            console.log(`  ${Fmt.gray}[ sᴛᴏʀᴀɢᴇ ᴇᴍᴘᴛʏ. ɴᴏ ᴀᴄᴄᴏᴜɴᴛs ʟɪɴᴋᴇᴅ ʏᴇᴛ ]${Fmt.reset}\n`);
        }
    } catch (e) {
        console.log(`  ${Fmt.red}❌ ᴇʀʀᴏʀ ʀᴇᴀᴅɪɴɢ ᴅᴀᴛᴀʙᴀsᴇ.${Fmt.reset}`);
    }

    console.log(`  ${Fmt.cyan}1.│${Fmt.reset} ʟɪɴᴋ ɴᴇᴡ sᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛ ᴠɪᴀ ɪɴᴄᴏɢɴɪᴛᴏ ʙʀᴏᴡsᴇʀ ᴡɪɴᴅᴏᴡ`);
    console.log(`  ${Fmt.cyan}2.│${Fmt.reset} ᴅᴇʟᴇᴛᴇ ᴀɴ ᴀᴄᴄᴏᴜɴᴛ ʀᴇᴄᴏʀᴅ`);
    console.log(`  ${Fmt.gray}3.│ ʀᴏʟʟʙᴀᴄᴋ ᴛᴏ ᴍᴀɪɴ ᴍᴇɴᴜ${Fmt.reset}\n`);

    const decision = await ask(`${Fmt.bold}${Fmt.cyan}>> sᴇʟᴇᴄᴛ ᴏᴘᴛɪᴏ联: ${Fmt.reset}`);
    if (decision === '1') return addAccountViaBrowserWindow();
    if (decision === '2') return removeSteamAccount();
    if (decision === '3') return homeMenu();
    profilesMenu();
}

async function addAccountViaBrowserWindow() {
    displayHeader('ʟɪɴᴋ ᴀᴄᴄᴏᴜɴᴛ ᴠɪᴀ ʙʀᴏᴡsᴇʀ');
    renderBox("ᴍᴜʟᴛɪ-ᴀᴄᴄᴏᴜɴᴛ ʀᴇɢɪsᴛʀᴀᴛɪᴏɴ", 
        "1. ᴀ ᴄʟᴇᴀɴ ʙʀᴏᴡsᴇʀ ᴡɪɴᴅᴏᴡ ᴡɪʟʟ ᴏᴘᴇɴ ɪɴ ɪɴᴄᴏɢɴɪᴛᴏ ᴍᴏᴅᴇ.\n" +
        "2. ʟᴏɢ ɪɴᴛᴏ ᴛʜᴇ sᴛᴇᴀᴍ ᴀᴄᴄᴏᴜɴᴛ ʏᴏᴜ ᴡᴀɴᴛ ᴛᴏ sᴀᴠᴇ (ᴜsᴇʀ/ᴘᴀss/sᴛᴇᴀᴍɢᴜᴀʀᴅ/ǫʀ).\n" +
        "3. ʟᴏɢɪɴ ᴄᴏᴍᴘʟᴇᴛᴇ, ᴅᴀᴛᴀ sᴀᴠᴇᴅ ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ.", 
        Fmt.magenta
    );

    console.log(`\n${Fmt.dim}ʟᴀᴜɴᴄʜɪɴɢ ᴛᴇᴍᴘᴏʀᴀʀʏ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ʙʀᴏᴡsᴇʀ ɪɴsᴛᴀɴᴄᴇ...${Fmt.reset}\n`);

    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        console.log(`${Fmt.cyan}🔄 ᴍᴏɴɪᴛᴏʀɪɴɢ ʟᴏɢɪɴ sᴛᴀᴛᴇ... ᴄᴏᴍᴘʟᴇᴛᴇ ᴛʜᴇ ᴀᴜᴛʜᴇɴᴛɪᴄᴀᴛɪᴏɴ ɪɴ ᴛʜᴇ ʙʀᴏᴡsᴇʀ.${Fmt.reset}`);

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
            console.log(`\n${Fmt.green}✓ sᴇssɪᴏɴ sᴛᴏʀᴇᴅ: ${steamId64}${Fmt.reset}`);
            const accountName = await ask(`📝 ${Fmt.bold}ᴇɴᴛᴇʀ ɴᴀᴍᴇ: ${Fmt.reset}`) || `Steam_${steamId64.substring(0, 6)}`;
            
            await browser.close();

            db.run(`INSERT OR REPLACE INTO steamprofiles (username, steamId, cookies, token) VALUES (?, ?, ?, ?)`, 
                [accountName, steamId64, JSON.stringify(cookies), 'API_Auth_Session'], (dbErr) => {
                    if (dbErr) {
                        renderBox("ᴅʙ ᴡʀɪᴛᴇ ᴇcodeʀʀᴏʀ", dbErr.message, Fmt.red);
                        setTimeout(() => profilesMenu(), 4000);
                        return;
                    }
                    profilesMenu(`ᴀᴄᴄᴏᴜɴᴛ [${accountName}] ᴀᴅaddᴇᴅ ᴀɴ slowed sᴇᴄᴜʀᴇᴅ ɪɴ sᴛᴏʀᴀɢE!`);
                }
            );
        } else {
            await browser.close();
            profilesMenu('ᴘʀᴏᴄᴇss ᴀʙᴏʀᴛᴇᴅ ᴏʀ ᴡɪɴᴅᴏᴡ ᴄʟᴏsᴇᴅ.');
        }
    } catch (err) {
        profilesMenu(`ᴀʟʟᴏᴄᴀᴛɪᴏɴ ᴇʀʀᴏʀ: ${err.message}`);
    }
}

async function removeSteamAccount() {
    const accountName = await ask(`🗑️ ` + Fmt.bold + `ᴇɴᴛᴇʀ ᴜsᴇʀ ɪᴅ ᴛᴏ ᴅᴇʟᴇᴛᴇ: ` + Fmt.reset);
    db.run(`DELETE FROM steamprofiles WHERE id = ? OR username = ?`, [accountName, accountName], () => {
        db.run(`DELETE FROM account_locks WHERE steamId = ?`, [accountName], () => {
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

function db_run(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

// --- ENGINE PIPELINE SEAMLESS FLUID LOOP WITH MEMORY LOCKS ---
async function autoRunMultiAPI() {
    while (true) {
        try {
            displayHeader('ᴘᴜʀᴇ ᴀᴘɪ ᴘɪᴘᴇʟɪɴᴇ ᴘʀᴏᴄᴇssɪɴɢ');
            
            console.log(`${Fmt.gray}[ᴀᴘɪ] ᴅᴏᴡɴʟᴏᴀᴅɪɴɢ ʟɪɴᴋs via ʀᴇᴘ4ʀᴇᴘ sᴇʀᴠᴇʀs...${Fmt.reset}`);
            const response = await fetch(`https://rep4rep.com/pub-api/user/steamprofiles?apiToken=${config.apiToken}`);
            const data = await response.json();
            
            if (data.error) {
                console.log(`${Fmt.red}[ᴀᴘɪ ᴇʀʀᴏʀ] sᴇʀᴠᴇʀ ʀᴇsᴘᴏɴsᴇ ᴅʀᴏᴘᴘᴇᴅ: ${data.error}${Fmt.reset}`);
                await new Promise(r => setTimeout(r, 15000));
                continue;
            }

            let repSteamProfiles = [];
            let repSteamProfilesObj = {};
            data.forEach((p) => {
                repSteamProfiles.push(p.steamId);
                repSteamProfilesObj[p.steamId] = p.id; 
            });

            const steamProfiles = await db_all('SELECT id, username, steamId, cookies, token FROM steamprofiles');
            
            // --- LIVE UPDATE RUNTIME WINDOW TITLE ---
            process.stdout.write(`\x1b]0;ʀᴇᴘ x ʀᴇᴘ ᴀᴘɪ │ ${steamProfiles.length} ᴀᴄᴄᴏᴜɴᴛ ʟᴏᴀᴅᴇᴅ\x07`);

            if (steamProfiles.length === 0) {
                console.log(`${Fmt.yellow}[ᴡᴀʀɴɪɴɢ] ʟᴏᴄᴀʟ ᴠᴀᴜʟᴛ sᴛᴏʀᴀɢᴇ ʜᴏʟᴅs 0 ᴀᴄᴄᴏᴜɴᴛs. sᴛᴏᴘ ᴘɪᴘᴇʟɪɴᴇ.${Fmt.reset}`);
                await ask(`\nᴘʀᴇss ᴇɴᴛᴇʀ ᴛᴏ ʀᴇᴛᴜʀɴ ᴛᴏ ᴍᴀɪɴ ᴅᴀsʜʙᴏᴀʀᴅ ᴍᴇɴᴜ...`);
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
                    console.log(`  ${Fmt.red}ʟᴏᴄᴋᴇᴅ [${steamProfile.username}] ${Math.ceil(remainingSeconds / 60)} ᴍɪɴѕ.${Fmt.reset}`);
                    continue;
                }

                activeAvailableAccountsCount++;

                try {
                    if (!repSteamProfiles.includes(steamProfile.steamId)) {
                        console.log(`[ᴀᴘɪ] ʀᴇɢɪsᴛᴇʀɪɴɢ ᴀᴄᴄᴏᴜɴ通 ɪᴅᴇntɪᴛʏ: ${steamProfile.username} ᴏɴ ʀᴇᴘ4ʀᴇᴘ ᴅᴀsʜʙᴏᴀʀᴅ...`);
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

                    renderBox("ᴀᴄᴛɪᴠᴇ sᴛʀᴇᴀᴍ ᴛᴀʀɢᴇᴛ", `ᴘʀᴏᴄᴇssɪɴɢ ᴀᴘɪ ʟᴏᴏᴘs ᴏɴ ᴀᴄᴄᴏᴜɴᴛ: ${steamProfile.username}`, Fmt.cyan);
                    community.setCookies(JSON.parse(steamProfile.cookies));
                    
                    const loggedIn = await new Promise((r) => community.loggedIn((err, li) => r(!err && li)));
                    if (!loggedIn) {
                        console.log(`  ${Fmt.red}❌ sᴇssɪᴏɴ ᴄᴏᴏᴋɪᴇs ᴇxᴘɪʀᴇᴅ ᴏɴ ${steamProfile.username}. sᴋɪᴘ ᴄᴏɴᴛᴇxᴛ...\n`);
                        continue;
                    }

                    let keepUsingAccount = true;

                    while (keepUsingAccount) {
                        const tasksRes = await fetch(`https://rep4rep.com/pub-api/tasks?apiToken=${config.apiToken}&steamProfile=${repSteamProfilesObj[steamProfile.steamId]}`);
                        const tasks = await tasksRes.json();
                        
                        if (tasks.error || tasks.length === 0) {
                            console.log(`  ${Fmt.gray}[sᴄᴀɴɴᴇʀ] ɴᴏ ᴍᴏʀᴇ ᴛᴀsᴋs ᴀᴠᴀɪʟᴀʙʟᴇ ᴏɴ ᴀᴄᴄᴏᴜɴᴛ: ${steamProfile.username}. ᴍᴏᴠɪɴɢ ᴛᴏ ɴᴇxᴛ ɴᴏᴅᴇ...${Fmt.reset}\n`);
                            keepUsingAccount = false;
                            break;
                        }

                        const currentBatch = tasks.slice(0, 3);
                        console.log(`${Fmt.gray}  ↳ ǫᴜᴇᴜᴇᴅ ʙᴀᴛᴄʜ sᴜʙsᴇᴛ: [${currentBatch.length}/3] ᴏᴘᴇʀᴀᴛɪᴏɴs ᴍᴀᴘᴘᴇᴅ.${Fmt.reset}\n`);

                        let accountRateLimited = false;

                        for (const task of currentBatch) {
                            console.log(`  ${Fmt.gray}-> ᴘᴜsʜɪɴɢ ᴄᴏᴍᴍᴇɴᴛ ᴘᴀʏxlᴏᴀᴅ:${Fmt.reset} ʜᴇᴀᴅɪɴɢ ᴛᴏ ᴛᴀʀɢᴇᴛ -> ${task.targetSteamProfileName}`);
                            
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
                                    console.log(`     ${Fmt.bold}${Fmt.yellow}⚠️ [ʀ4ʀ ʀᴇᴊᴇᴄᴛɪᴏɴ] sᴇʀᴠᴇʀ ᴅcodeʀᴏᴘᴘᴇᴅ ᴠᴀʟɪᴅᴀᴛɪᴏɴ ʀᴇsᴘᴏɴsᴇ: ${r4rData.error}${Fmt.reset}\n`);
                                } else {
                                    console.log(`     ${Fmt.bold}${Fmt.green}[sᴜᴄᴄᴇss] (ᴛᴀʀɢᴇᴛ ɪᴅ: ${task.targetSteamProfileId}) ᴄᴏᴍᴍᴇɴᴛ sʏɴᴄᴇᴅ ᴏɴ ʀᴇᴘ4ʀᴇᴘ.${Fmt.reset}\n`);
                                    totalTasksProcessedInCycle++;
                                }

                                await new Promise(r => setTimeout(r, 15000));

                            } catch (steamError) {
                                console.log(`     ${Fmt.bold}${Fmt.red}❌ [sᴛᴇᴀᴍ ᴄʀɪᴛɪᴄᴀʟ ʀᴇᴊᴇᴄᴛɪᴏɴ] ${steamError.message}${Fmt.reset}`);
                                
                                const lockExpiryISO = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                                await db_run(`INSERT OR REPLACE INTO account_locks (steamId, lock_until) VALUES (?, ?)`, [steamProfile.steamId, lockExpiryISO]);
                                
                                console.log(`\n🚨 ${Fmt.bold}${Fmt.red}[ᴘʀᴏᴛᴇᴄᴛɪᴏɴ ᴀᴄᴛɪᴠᴇ] [${steamProfile.username}] ʟᴏᴄᴋᴇᴅ ɪɴᴅblock_untilʟʏ ᴘᴀʀᴀ 1 ʜᴏᴜʀ. sᴋɪᴘ ᴛᴏ ɴᴇxᴛ...${Fmt.reset}\n`);
                                
                                accountRateLimited = true;
                                keepUsingAccount = false; 
                                break; 
                            }
                        }

                        if (!accountRateLimited && keepUsingAccount) {
                            console.log(`\n${Fmt.bold}${Fmt.green}[⚡ ʜɪʟᴏ ᴅɪʀᴇᴄᴛᴏ] ʙᴀᴛᴄʜ sᴜᴄᴄᴇss ᴏɴ [${steamProfile.username}]. ᴄᴏɴᴛɪɴᴜɪɴɢ ᴇxᴇᴄᴜᴛɪᴏɴ ᴏɴ ᴛʜɪs ᴀᴄᴄᴏᴜɴᴛ...${Fmt.reset}\n`);
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }

                } catch (profileException) {
                    console.log(`  ${Fmt.red}❌ [ᴀᴄᴄᴏᴜɴᴛ ɪssᴜᴇ] ɪsᴏʟᴀᴛɪᴏɴ ʙʟᴏᴄᴋ ᴄᴀᴜɢʜᴛ ᴇʀʀᴏʀ ᴏɴ ${steamProfile.username}: ${profileException.message}${Fmt.reset}\n`);
                }
            }
            
            // --- LOOP CONTROL CONDITIONAL FLOWS ---
            if (totalTasksProcessedInCycle > 0) {
                await new Promise(r => setTimeout(r, 2000));
            } 
            else if (activeAvailableAccountsCount === 0 && nearestUnlockTime !== Infinity) {
                console.log(`\n${Fmt.bold}${Fmt.red}[Aʟʟ ᴀᴄᴄᴏᴜɴᴛs ʟᴏᴄᴋᴇᴅᴏᴜᴛ] ᴇᴠᴇʀʏ ᴀᴄᴄᴏᴜɴᴛ ɪɴsɪᴅᴇ sᴛᴏʀᴀɢᴇ ɪs ᴄᴜʀʀᴇɴᴛʟʏ ʀᴇsᴛʀɪᴄᴛᴇᴅ.${Fmt.reset}`);
                console.log(`\n${Fmt.gray}🔄 ᴜᴘᴅᴀᴛɪɴɢ ʟᴏᴄᴋ sᴛᴀᴛᴜs ʟɪsᴛ ɪɴ 60 sᴇᴄᴏɴᴅs...${Fmt.reset}`);
                await new Promise(r => setTimeout(r, 60000));
            } 
            else {
                console.log(`\n${Fmt.gray}[ɴᴏᴛᴇ] ᴀʟʟ ᴀᴄᴛɪᴠᴇ ǫᴜᴇᴜᴇs ᴀʀᴇ ᴇᴍᴘᴛʏ. ʀᴇsᴛɪɴɢ 1 ᴍɪɴᴜᴛᴇ ᴘʀɪᴏʀ ᴛᴏ ᴄʜᴇᴄᴋɪɴɢ ʙᴀᴄᴋ...${Fmt.reset}`);
                await countdown(60, "⏳ ǫᴜᴇᴜᴇ ᴇᴍᴘᴛʏ ᴄᴏᴏʟᴅᴏᴡɴ");
            }

        } catch (globalError) {
            console.log(`${Fmt.red}[ᴄʀɪᴛɪᴄᴀʟ ᴄᴏʀᴇ ᴇxᴄᴇᴘᴛɪᴏɴ] ɪᴛᴇʀᴀᴛɪᴏɴ ʙʀᴇᴀᴋ: ${globalError.message}${Fmt.reset}`);
            await new Promise(r => setTimeout(r, 10000));
        }
    }
}
