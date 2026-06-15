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

const db = new sqlite3.Database('./steamprofiles.db', (err) => {
    if (err) process.exit(1);
    initializeSchema();
    homeMenu();
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
        // Persistent database memory for independent 1-hour account lockouts
        db.run(`CREATE TABLE IF NOT EXISTS account_locks (
            steamId text PRIMARY KEY,
            lock_until text
        )`);
    });
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

function displayHeader(subtitle = 'Dashboard') {
    console.log('\x1Bc');
    console.log(`${Fmt.bold}${Fmt.bgMagenta}${Fmt.white}  BUNNY COMMUNITY MODULE 🚀  ${Fmt.reset} ${Fmt.dim}v${version}${Fmt.reset}`);
    console.log(`${Fmt.dim} Current Context: ${Fmt.reset}${Fmt.italic}${Fmt.magenta}${subtitle}${Fmt.reset}\n`);
}

async function countdown(seconds, prefix = "⏳ COOLDOWN") {
    while (seconds > 0) {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        process.stdout.write(`\r     ${Fmt.bold}${Fmt.yellow}${prefix}: Next sync cycle ready in [${mins}:${secs}]${Fmt.reset} `);
        await new Promise(r => setTimeout(r, 1000));
        seconds--;
    }
    console.log("\n");
}

async function homeMenu(notification = false) {
    displayHeader('Main Core');
    if (notification) console.log(` ${Fmt.bgBlue}${Fmt.white}${Fmt.bold} INFO ${Fmt.reset} ${Fmt.cyan}${notification}${Fmt.reset}\n`);

    console.log(`  ${Fmt.magenta}1.│${Fmt.reset} ${Fmt.bold}Run Multi-Account API Pipeline (Continuous Automated Loop)${Fmt.reset}`);
    console.log(`  ${Fmt.magenta}2.│${Fmt.reset} ${Fmt.bold}Manage Steam Accounts Vault${Fmt.reset} ${Fmt.gray}(Add/Remove Cuentas)${Fmt.reset}`);
    console.log('\n  ' + Fmt.gray + 'Press CTRL + C to exit.' + Fmt.reset + '\n');

    const decision = await ask(`${Fmt.bold}${Fmt.magenta}>> Select Path: ${Fmt.reset}`);
    if (decision === '1') return autoRunMultiAPI();
    if (decision === '2') return profilesMenu();
    homeMenu();
}

async function profilesMenu(notification = false) {
    displayHeader('Accounts Vault');
    if (notification) console.log(` ${Fmt.bgBlue}${Fmt.white}${Fmt.bold} STATE ${Fmt.reset} ${Fmt.yellow}${notification}${Fmt.reset}\n`);

    try {
        const rows = await db_all('SELECT id, username, steamId, last_comment FROM steamprofiles');
        if (rows.length > 0) {
            console.log(`${Fmt.bold}${Fmt.cyan} Local Registered Accounts:${Fmt.reset}`);
            console.table(rows);
        } else {
            console.log(`  ${Fmt.gray}[ Storage empty. No accounts linked yet ]${Fmt.reset}\n`);
        }
    } catch (e) {
        console.log(`  ${Fmt.red}❌ Error parsing DB profiles.${Fmt.reset}`);
    }

    console.log(`  ${Fmt.cyan}1.│${Fmt.reset} Link New Steam Account via Incognito Browser Window`);
    console.log(`  ${Fmt.cyan}2.│${Fmt.reset} Delete an account record`);
    console.log(`  ${Fmt.gray}3.│ Rollback to main menu${Fmt.reset}\n`);

    const decision = await ask(`${Fmt.bold}${Fmt.cyan}>> Select Option: ${Fmt.reset}`);
    if (decision === '1') return addAccountViaBrowserWindow();
    if (decision === '2') return removeSteamAccount();
    if (decision === '3') return homeMenu();
    profilesMenu();
}

async function addAccountViaBrowserWindow() {
    displayHeader('Link Account via Browser');
    renderBox("Multi-Account Registration", 
        "1. A clean browser window will open in Incognito mode.\n" +
        "2. Log into the Steam account you want to save (User/Pass/SteamGuard/QR).\n" +
        "3. Once successfully logged in, the script captures the cookies automatically.", 
        Fmt.magenta
    );

    console.log(`\n${Fmt.dim}Launching temporary authentication browser instance...${Fmt.reset}\n`);

    try {
        const browser = await puppeteer.launch({
            headless: false,
            args: ['--incognito', '--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const pages = await browser.pages();
        const page = pages[0];
        await page.goto('https://steamcommunity.com/login/home/', { waitUntil: 'networkidle2' });

        console.log(`${Fmt.cyan}🔄 Monitoring login state... Complete the authentication in the browser.${Fmt.reset}`);

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
            console.log(`\n${Fmt.green}✓ Login session captured for SteamID: ${steamId64}${Fmt.reset}`);
            const accountName = await ask(`📝 ${Fmt.bold}Enter an alias/username for this account: ${Fmt.reset}`) || `Steam_${steamId64.substring(0, 6)}`;
            
            await browser.close();

            db.run(`INSERT OR REPLACE INTO steamprofiles (username, steamId, cookies, token) VALUES (?, ?, ?, ?)`, 
                [accountName, steamId64, JSON.stringify(cookies), 'API_Auth_Session'], (dbErr) => {
                    if (dbErr) {
                        renderBox("DB FAIL", dbErr.message, Fmt.red);
                        setTimeout(() => profilesMenu(), 4000);
                        return;
                    }
                    profilesMenu(`Account [${accountName}] added and secured in storage!`);
                }
            );
        } else {
            await browser.close();
            profilesMenu('Process aborted or window closed.');
        }
    } catch (err) {
        profilesMenu(`Allocation error: ${err.message}`);
    }
}

async function removeSteamAccount() {
    const accountName = await ask(`🗑️ ` + Fmt.bold + `Enter account username or ID to remove from vault: ` + Fmt.reset);
    db.run(`DELETE FROM steamprofiles WHERE id = ? OR username = ?`, [accountName, accountName], () => {
        db.run(`DELETE FROM account_locks WHERE steamId = ?`, [accountName], () => {
            profilesMenu('Account record successfully dropped from local database.');
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
            displayHeader('Pure API Pipeline Processing');
            
            console.log(`${Fmt.gray}[API] Fetching profile linkages from Rep4Rep servers...${Fmt.reset}`);
            const response = await fetch(`https://rep4rep.com/pub-api/user/steamprofiles?apiToken=${config.apiToken}`);
            const data = await response.json();
            
            if (data.error) {
                console.log(`${Fmt.red}[API ERROR] Server response dropped: ${data.error}${Fmt.reset}`);
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
            if (steamProfiles.length === 0) {
                console.log(`${Fmt.yellow}[WARNING] Local vault storage holds 0 accounts. Stop pipeline.${Fmt.reset}`);
                await ask(`\nPress Enter to return to main dashboard menu...`);
                return homeMenu();
            }

            // Retrieve all active persistent database 1-hour memory locks
            const currentLocks = await db_all('SELECT steamId, lock_until FROM account_locks');
            const locksMap = {};
            currentLocks.forEach(l => { locksMap[l.steamId] = new Date(l.lock_until).getTime(); });

            let totalTasksProcessedInCycle = 0;
            let activeAvailableAccountsCount = 0;
            let nearestUnlockTime = Infinity;

            for (const steamProfile of steamProfiles) {
                const lockTime = locksMap[steamProfile.steamId] || 0;
                const nowTime = Date.now();

                // Memory lock check: Skip the account completely if it is in an independent 1-hour lockout
                if (lockTime > nowTime) {
                    const remainingSeconds = Math.ceil((lockTime - nowTime) / 1000);
                    if (lockTime < nearestUnlockTime) nearestUnlockTime = lockTime;
                    console.log(`  ${Fmt.red}🚨 Independent Lock Active [${steamProfile.username}]:${Fmt.reset} Suspended for another ${Math.ceil(remainingSeconds / 60)} mins. Skipping context...`);
                    continue;
                }

                activeAvailableAccountsCount++;

                try {
                    if (!repSteamProfiles.includes(steamProfile.steamId)) {
                        console.log(`[API] Registering account identity: ${steamProfile.username} on Rep4Rep dashboard...`);
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

                    renderBox("ACTIVE STREAM TARGET", `Processing API requests for account: ${steamProfile.username}`, Fmt.cyan);
                    community.setCookies(JSON.parse(steamProfile.cookies));
                    
                    const loggedIn = await new Promise((r) => community.loggedIn((err, li) => r(!err && li)));
                    if (!loggedIn) {
                        console.log(`  ${Fmt.red}❌ Session cookies expired for ${steamProfile.username}. Skipping context execution...${Fmt.reset}\n`);
                        continue;
                    }

                    let keepUsingAccount = true;

                    // CONTINUOUS TARGET HOOK: Keep pulling tasks and processing this account as long as it succeeds
                    while (keepUsingAccount) {
                        const tasksRes = await fetch(`https://rep4rep.com/pub-api/tasks?apiToken=${config.apiToken}&steamProfile=${repSteamProfilesObj[steamProfile.steamId]}`);
                        const tasks = await tasksRes.json();
                        
                        if (tasks.error || tasks.length === 0) {
                            console.log(`  ${Fmt.gray}[SCANNER] No more tasks available for account: ${steamProfile.username}. Moving to next node...${Fmt.reset}\n`);
                            keepUsingAccount = false;
                            break;
                        }

                        const currentBatch = tasks.slice(0, 3);
                        console.log(`${Fmt.gray}  ↳ Queued batch subset: [${currentBatch.length}/3] operations mapped.${Fmt.reset}\n`);

                        let accountRateLimited = false;

                        for (const task of currentBatch) {
                            console.log(`  ${Fmt.gray}-> Pushing comment payload:${Fmt.reset} heading to target -> ${task.targetSteamProfileName}`);
                            
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
                                    console.log(`     ${Fmt.bold}${Fmt.yellow}⚠️ [R4R REJECTION] Server dropped validation response: ${r4rData.error}${Fmt.reset}\n`);
                                } else {
                                    console.log(`     ${Fmt.bold}${Fmt.green}[SUCCESS] (Target ID: ${task.targetSteamProfileId}) Comment synced on Rep4Rep.${Fmt.reset}\n`);
                                    totalTasksProcessedInCycle++;
                                }

                                await new Promise(r => setTimeout(r, 15000)); // Standard safety spacing between individual items

                            } catch (steamError) {
                                console.log(`     ${Fmt.bold}${Fmt.red}❌ [STEAM CRITICAL REJECTION] ${steamError.message}${Fmt.reset}`);
                                
                                // Hard lockout timestamp initialization (Current time + 1 hour forward memory stamp)
                                const lockExpiryISO = new Date(Date.now() + 60 * 60 * 1000).toISOString();
                                await db_run(`INSERT OR REPLACE INTO account_locks (steamId, lock_until) VALUES (?, ?)`, [steamProfile.steamId, lockExpiryISO]);
                                
                                console.log(`\n🚨 ${Fmt.bold}${Fmt.red}[PROTECTION ACTIVE] [${steamProfile.username}] locked independently for 1 HOUR. Skipping to next account instantly...${Fmt.reset}\n`);
                                
                                accountRateLimited = true;
                                keepUsingAccount = false; // Break continuous execution loop for this account context
                                break; 
                            }
                        }

                        // If the batch completed cleanly with zero faults, keep using this account (it stays in the while loop)
                        if (!accountRateLimited && keepUsingAccount) {
                            console.log(`\n${Fmt.bold}${Fmt.green}[⚡ FAST TRACK] Batch successful on [${steamProfile.username}]. Continuing execution on this account...${Fmt.reset}\n`);
                            await new Promise(r => setTimeout(r, 3000));
                        }
                    }

                } catch (profileException) {
                    console.log(`  ${Fmt.red}❌ [PROFILE EXCEPTION] Isolation block caught error on ${steamProfile.username}: ${profileException.message}${Fmt.reset}\n`);
                }
            }
            
            // --- LOOP CONTROL CONDITIONAL FLOWS ---
            if (totalTasksProcessedInCycle > 0) {
                // SUCESO FLOW: If tasks were processed successfully across any unlocked nodes, re-run immediately
                await new Promise(r => setTimeout(r, 2000));
            } 
            else if (activeAvailableAccountsCount === 0 && nearestUnlockTime !== Infinity) {
                // ALL NODES LOCKED: No blocking countdown. Print status, sleep 60s, loop clears screen and prints freshly updated minutes
                console.log(`\n${Fmt.bold}${Fmt.red}[ALL ACCOUNTS LOCKEDOUT] Every account inside storage is currently restricted.${Fmt.reset}`);
                console.log(`\n${Fmt.gray}🔄 Refreshing lock status list in 60 seconds...${Fmt.reset}`);
                await new Promise(r => setTimeout(r, 60000));
            } 
            else {
                // QUEUE EMPTY: No tasks available on unlocked profiles. Sleep 1 minute to stay clean on the server API
                console.log(`\n${Fmt.gray}[INFO] All active profile queues are empty. Resting for 1 minute before checking back...${Fmt.reset}`);
                await countdown(60, "⏳ QUEUE EMPTY COOLDOWN");
            }

        } catch (globalError) {
            console.log(`${Fmt.red}[CRITICAL CORE EXCEPTION] Iteration break: ${globalError.message}${Fmt.reset}`);
            await new Promise(r => setTimeout(r, 10000));
        }
    }
}
