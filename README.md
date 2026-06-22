# 🌌 rep4rep-api - Steam & Rep4Rep Pipeline
[![GitHub repo](https://img.shields.io/badge/github-BunnyHoper-blue?style=for-the-badge&logo=github)](https://github.com/BunnyHoper)
[![Runtime](https://img.shields.io/badge/Runtime-Node.js%2020+-green?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Version](https://img.shields.io/badge/ver-1.0.0-red?style=for-the-badge)](https://github.com/aritzbaraka90-tech)
[![Donate](https://img.shields.io/badge/Support%20Me-paypal.me/AritzGonzalez7-yellowgreen?style=for-the-badge&logo=paypal)](https://paypal.me/AritzGonzalez7)

> **Automate your reputation building (fast & easy).** This tool creates a seamless bridge between your Steam accounts and the Rep4Rep API, handling tasks, verifications, and rate-limit protection autonomously.

---

## ✨ ɪɴᴛʀᴏᴅᴜᴄᴛɪᴏɴ: ᴏᴘᴛɪᴍɪᴢᴇᴅ ᴛᴇʀᴍɪɴᴀʟ ᴅᴏᴡɴʟᴏᴀᴅѕ

Stop manually managing comments and tasks (it's a waste of time). **rep4rep-api** is an automated engine designed to handle multiple Steam accounts simultaneously. It integrates directly with Rep4Rep services to maximize efficiency, handling posting, verification, and independent lockout management without manual input.

---

## 🛠️ ᴄᴏʀᴇ ᴄᴀᴘᴀʙɪʟɪᴛɪᴇѕ

*   **API-Driven Pipeline:** Fetches tasks directly from Rep4Rep and executes them via native Steam API calls.
*   **Multi-Account Vault:** Safely stores session cookies for multiple Steam accounts in a local SQLite database.
*   **Smart Rate-Limit Protection:** Implements persistent, independent 1-hour memory locks (stored in `account_locks` table) for any account flagged by Steam.
*   **Continuous Batch Processing:** Seamlessly switches between accounts to ensure tasks are completed as long as the accounts remain healthy.

---

## 📂 ᴀʀᴄʜɪᴛᴇᴄᴛᴜʀᴇ -- ʀᴏᴏᴛ

| Folder/File | Type | Action |
| :--- | :---: | :--- |
| `index.js` | **Core** | The primary automation engine. Runs the continuous loop and API logic. |
| `config.json` | **Config** | Holds your `apiToken` and global system settings. |
| `steamprofiles.db` | **Database** | Stores account cookies, aliases, and active 1-hour memory locks. |

---

## ⚙️ ǫᴜɪᴄᴋ ѕᴛᴀʀᴛ ɢᴜɪᴅᴇ

1.  **Dependencies:** Ensure Node.js is installed.
    ```bash
    npm install
    ```

2.  **Configuration:** Update `config.json` with your Rep4Rep API Token.

3.  **Account Registration:** Run the script and navigate to the "Accounts Vault" to link your Steam profiles via the automated incognito browser window.

4.  **Execute:** Start the background pipeline to begin task processing:
    ```bash
    node index.js
    ```

---

## 🤝 ᴄᴏɴᴛʀɪʙᴜᴛɪᴏɴ ᴀɴᴅ ѕᴜᴘᴘᴏʀᴛ

Contributions are welcome. If you encounter issues with API handling or account management:

1.  Fork the repository.
2.  Create a feature branch.
3.  Commit your improvements.
4.  Open a **Pull Request**.

---

## 📜 ʟɪᴄᴇɴѕᴇ

Feel free to do any u want with my scripts. God bless.

***
*Built with ❤️ by Bunny.*
