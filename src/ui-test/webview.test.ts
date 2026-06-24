import { VSBrowser, TextEditor, EditorView, Workbench, WebView, By, Key } from "vscode-extension-tester";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

describe("SQL-PHP Intellisense UI Run SQL Webview Test", () => {
    let browser: VSBrowser;

    const dummyWorkspace = path.resolve(__dirname, "../../src/ui-test/workspace");
    const dummyFilePath = path.join(dummyWorkspace, "webview_demo.php");
    const screenshotsDir = path.resolve(__dirname, "../../screenshots");

    const sleep = (ms: number) => browser.driver.sleep(ms);

    before(async () => {
        browser = VSBrowser.instance;

        // Setup directories and initial files
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        if (!fs.existsSync(dummyWorkspace)) {
            fs.mkdirSync(dummyWorkspace, { recursive: true });
        }
        fs.writeFileSync(dummyFilePath, '<?php\n\nDatabase::prepare("SELECT * FROM users");');
    });

    it("runs SQL query via Quick Fix and shows results table in Webview", async function () {
        this.timeout(120000);

        const workbench = new Workbench();

        // Open the workspace/file in VS Code
        await browser.openResources(dummyFilePath);
        await sleep(3000); // Wait for workbench and extension to activate
        await workbench.executeCommand("workbench.action.closeSidebar");
        await sleep(1000);

        // Get the editor and focus it
        const editor = (await new EditorView().openEditor("webview_demo.php")) as TextEditor;
        await editor.click();
        await sleep(1000);

        // 1. Highlight the query and capture Frame 1
        await editor.setCursor(3, 20);
        await sleep(1000);

        let actions = browser.driver.actions();
        await actions.clear();
        actions = actions.keyDown(Key.SHIFT);
        for (let i = 0; i < 19; i++) {
            actions = actions.sendKeys(Key.RIGHT);
        }
        actions = actions.keyUp(Key.SHIFT);
        await actions.perform();
        await sleep(1500);

        const frame1Path = path.join(screenshotsDir, "webview_frame1.png");
        const screen1 = await browser.driver.takeScreenshot();
        fs.writeFileSync(frame1Path, screen1, "base64");
        console.log(`Saved Frame 1 to: ${frame1Path}`);

        // 2. Open the Quick Fix menu and capture Frame 2
        await workbench.executeCommand("editor.action.quickFix");
        await sleep(2000); // Wait for quick action popup to appear

        const frame2Path = path.join(screenshotsDir, "webview_frame2.png");
        const screen2 = await browser.driver.takeScreenshot();
        fs.writeFileSync(frame2Path, screen2, "base64");
        console.log(`Saved Frame 2 to: ${frame2Path}`);

        // Find the "Run Selected SQL Query" action and click it
        const driver = browser.driver;
        const quickFixItem = await driver.findElement(By.xpath("//*[contains(text(), 'Run Selected SQL Query')]"));
        await driver.executeScript("arguments[0].click();", quickFixItem);
        await sleep(4000); // Wait for webview page to load beside the editor

        // 3. Switch to Webview frame, verify mock table data, and capture Frame 3
        const webview = new WebView();
        await webview.switchToFrame();

        const tableRows = await webview.findWebElements(By.css("table tr"));
        if (tableRows.length < 2) {
            throw new Error(`Expected at least 2 rows in the webview table, got ${tableRows.length}`);
        }

        const headerText = await tableRows[0].getText();
        const dataText = await tableRows[1].getText();

        console.log(`Webview Table Header: ${headerText}`);
        console.log(`Webview Table Data: ${dataText}`);

        if (!headerText.includes("username") || !dataText.includes("john_doe")) {
            throw new Error("Webview content did not match expected mock table headers/values.");
        }

        await webview.switchBack();

        const frame3Path = path.join(screenshotsDir, "webview_frame3.png");
        const screen3 = await browser.driver.takeScreenshot();
        fs.writeFileSync(frame3Path, screen3, "base64");
        console.log(`Saved Frame 3 to: ${frame3Path}`);

        // 4. Compile frames into animated GIF
        const gifPath = path.join(screenshotsDir, "webview-results.gif");
        try {
            execSync(`/opt/homebrew/bin/convert -delay 200 -loop 0 "${frame1Path}" "${frame2Path}" "${frame3Path}" "${gifPath}"`);
            console.log(`Successfully generated animated GIF at: ${gifPath}`);
        } catch (err) {
            console.error("Failed to compile GIF with convert:", err);
        }

        // Clean up frames
        if (fs.existsSync(frame1Path)) fs.unlinkSync(frame1Path);
        if (fs.existsSync(frame2Path)) fs.unlinkSync(frame2Path);
        if (fs.existsSync(frame3Path)) fs.unlinkSync(frame3Path);

        // Clean up editors
        await new EditorView().closeAllEditors();
    });

    after(async () => {
        // Clean up dummy workspace folder and files
        if (fs.existsSync(dummyFilePath)) {
            fs.unlinkSync(dummyFilePath);
        }
        if (fs.existsSync(dummyWorkspace)) {
            fs.rmdirSync(dummyWorkspace);
        }
    });
});
