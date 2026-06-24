import { VSBrowser, Workbench, EditorView } from "vscode-extension-tester";
import * as fs from "fs";
import * as path from "path";

describe("SQL-PHP Intellisense UI Commands Test", () => {
    let browser: VSBrowser;
    const screenshotsDir = path.resolve(__dirname, "../../screenshots");
    const sleep = (ms: number) => browser.driver.sleep(ms);

    before(async () => {
        browser = VSBrowser.instance;
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
    });

    it("runs Delete Database Credentials command and verifies success notification", async function () {
        this.timeout(90000);

        // Make sure all editors are closed first
        await new EditorView().closeAllEditors();
        await sleep(1000);

        // Execute Delete Database Credentials command
        const workbench = new Workbench();
        await workbench.executeCommand("workbench.action.closeSidebar");
        await sleep(1000);
        await workbench.executeCommand("SQL-PHP: Delete Database Credentials");
        await sleep(2500); // Wait for command execution and notification banner

        // Take a screenshot of the window with the notification shown
        const screenshotPath = path.join(screenshotsDir, "delete-credentials.png");
        const screen = await browser.driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screen, "base64");
        console.log(`Saved command notification screenshot to: ${screenshotPath}`);

        // Verify the success notification message in the notification center
        const notifications = await workbench.getNotifications();
        let successNotificationFound = false;
        let notificationMsg = "";

        for (const notification of notifications) {
            const text = await notification.getMessage();
            if (text.includes("Successfully removed database credentials")) {
                successNotificationFound = true;
                notificationMsg = text;
                break;
            }
        }

        console.log(`Active notifications count: ${notifications.length}`);
        if (!successNotificationFound) {
            throw new Error("Could not find success notification for deleted database credentials.");
        }
        console.log(`Found notification: ${notificationMsg}`);
    });
});
