import { VSBrowser, TextEditor, EditorView, Key } from "vscode-extension-tester";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

describe("SQL-PHP Intellisense UI Autocomplete Screenshot", () => {
    let browser: VSBrowser;

    const dummyWorkspace = path.resolve(__dirname, "../../src/ui-test/workspace");
    const dummyFilePath = path.join(dummyWorkspace, "demo.php");
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
        fs.writeFileSync(dummyFilePath, '<?php\n\nDatabase::prepare("SELECT * FROM ");');
    });

    it("opens dummy file and triggers autocomplete to take screenshot", async function () {
        this.timeout(90000); // Allow sufficient time for the test VS Code window to start up

        // Open the workspace/file in VS Code
        await browser.openResources(dummyFilePath);
        await sleep(3000); // Wait for the workbench and extension to activate

        // Get the editor and focus it
        const editor = (await new EditorView().openEditor("demo.php")) as TextEditor;
        await editor.click();
        await sleep(1000);

        // Move cursor back inside the quotes, right after the space
        await editor.moveCursor(3, 34);
        await sleep(1000);

        // 1. Trigger and capture Table suggestions
        await editor.typeText("`");
        await sleep(3500); // Wait for suggestions to render

        const tableFrame = await editor.takeScreenshot();
        const frame1Path = path.join(screenshotsDir, "frame1.png");
        fs.writeFileSync(frame1Path, tableFrame, "base64");
        console.log(`Saved table suggestions frame to: ${frame1Path}`);

        // Select second suggestion (orders) by going DOWN then ENTER
        await editor.typeText(Key.DOWN);
        await sleep(500);
        await editor.typeText(Key.ENTER);
        await sleep(1000);

        // Capture frame 2 (selected orders table)
        const ordersFrame = await editor.takeScreenshot();
        const frame2Path = path.join(screenshotsDir, "frame2.png");
        fs.writeFileSync(frame2Path, ordersFrame, "base64");
        console.log(`Saved orders table selected frame to: ${frame2Path}`);

        // 2. Trigger and capture Field suggestions
        await editor.typeText(" WHERE `");
        await sleep(3500); // Wait for suggestions to render

        const fieldFrame = await editor.takeScreenshot();
        const frame3Path = path.join(screenshotsDir, "frame3.png");
        fs.writeFileSync(frame3Path, fieldFrame, "base64");
        console.log(`Saved field suggestions frame to: ${frame3Path}`);

        // 3. Assemble GIF using ImageMagick
        const gifPath = path.join(screenshotsDir, "autocomplete-suggestions.gif");
        try {
            execSync(`/opt/homebrew/bin/convert -delay 150 -loop 0 "${frame1Path}" "${frame2Path}" "${frame3Path}" "${gifPath}"`);
            console.log(`Successfully generated animated GIF at: ${gifPath}`);
        } catch (err) {
            console.error("Failed to generate GIF using convert:", err);
        }

        // Clean up frames
        if (fs.existsSync(frame1Path)) fs.unlinkSync(frame1Path);
        if (fs.existsSync(frame2Path)) fs.unlinkSync(frame2Path);
        if (fs.existsSync(frame3Path)) fs.unlinkSync(frame3Path);

        // Save editor to clear "dirty" state and close it
        await editor.save();
        await sleep(1000);
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
