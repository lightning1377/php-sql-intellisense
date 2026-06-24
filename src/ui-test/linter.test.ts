import { VSBrowser, TextEditor, EditorView, BottomBarPanel, MarkerType, Workbench } from "vscode-extension-tester";
import * as fs from "fs";
import * as path from "path";

describe("SQL-PHP Intellisense UI Linter Test", () => {
    let browser: VSBrowser;

    const dummyWorkspace = path.resolve(__dirname, "../../src/ui-test/workspace");
    const dummyFilePath = path.join(dummyWorkspace, "linter_demo.php");
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
        // Write file with a query referencing a non-existent field
        fs.writeFileSync(dummyFilePath, '<?php\n\nDatabase::prepare("SELECT invalid_field FROM users");');
    });

    it("saves file and checks Problems View for query linting errors", async function () {
        this.timeout(90000);

        const workbench = new Workbench();

        // Open the workspace/file in VS Code
        await browser.openResources(dummyFilePath);
        await sleep(3000); // Wait for workbench and extension to activate
        await workbench.executeCommand("workbench.action.closeSidebar");
        await sleep(1000);

        // Get the editor, focus it, and save to trigger linter
        const editor = (await new EditorView().openEditor("linter_demo.php")) as TextEditor;
        await editor.click();
        await sleep(1000);
        await editor.save();
        await sleep(2500); // Wait for linter diagnostics to register

        // Open Problems view in the bottom bar panel
        const bottomBar = new BottomBarPanel();
        const problemsView = await bottomBar.openProblemsView();
        await sleep(1500);

        // Take a screenshot of the workspace with diagnostics shown
        const screenshotPath = path.join(screenshotsDir, "linter-problems.png");
        const screen = await browser.driver.takeScreenshot();
        fs.writeFileSync(screenshotPath, screen, "base64");
        console.log(`Saved linter diagnostics screenshot to: ${screenshotPath}`);

        // Search for our diagnostic message
        const markers = await problemsView.getAllVisibleMarkers(MarkerType.Any);
        let foundError = false;
        let errorText = "";

        for (const marker of markers) {
            const text = await marker.getText();
            if (text.includes("Field name 'invalid_field' not found in table 'users'")) {
                foundError = true;
                errorText = text;
                break;
            }
        }

        console.log(`Diagnostic markers found: ${markers.length}`);
        if (!foundError) {
            throw new Error("Could not find linting diagnostic marker for 'invalid_field' inside table 'users'.");
        }
        console.log(`Found marker: ${errorText}`);

        // Clean up editor and close bottom panel
        await bottomBar.toggle(false);
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
