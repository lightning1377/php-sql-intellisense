import { VSBrowser, TextEditor, EditorView, Workbench, By } from "vscode-extension-tester";
import * as fs from "fs";
import * as path from "path";

describe("SQL-PHP Intellisense UI Hover Test", () => {
    let browser: VSBrowser;

    const dummyWorkspace = path.resolve(__dirname, "../../src/ui-test/workspace");
    const dummyFilePath = path.join(dummyWorkspace, "hover_demo.php");
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
        fs.writeFileSync(dummyFilePath, '<?php\n\nDatabase::prepare("SELECT username FROM users");');
    });

    it("triggers hover over column name and verifies data type", async function () {
        this.timeout(90000);

        const workbench = new Workbench();

        // Open the workspace/file in VS Code
        await browser.openResources(dummyFilePath);
        await sleep(3000); // Wait for workbench and extension to activate
        await workbench.executeCommand("workbench.action.closeSidebar");
        await sleep(1000);

        // Get the editor and focus it
        const editor = (await new EditorView().openEditor("hover_demo.php")) as TextEditor;
        await editor.click();
        await sleep(1000);

        // Move cursor to "username" column name inside query (line 3, column 30)
        await editor.moveCursor(3, 30);
        await sleep(1000);

        // Trigger hover command
        await workbench.executeCommand("Show Hover");
        await sleep(2500); // Wait for hover popover to display

        // Take screenshot of the hover
        const screenshotPath = path.join(screenshotsDir, "hover.png");
        const screen = await browser.driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screen, "base64");
        console.log(`Saved hover screenshot to: ${screenshotPath}`);

        // Verify hover content in VS Code's DOM
        const driver = browser.driver;
        const hoverElement = await driver.findElement(By.className("monaco-hover"));
        const hoverText = await hoverElement.getText();

        console.log(`Hover contents: ${hoverText}`);
        if (!hoverText.includes("varchar(255)")) {
            throw new Error(`Expected hover to contain type 'varchar(255)', but got: ${hoverText}`);
        }

        // Clean up editor
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
