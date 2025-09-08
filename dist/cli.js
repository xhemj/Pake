#!/usr/bin/env node
import chalk from 'chalk';
import { InvalidArgumentError, program, Option } from 'commander';
import log from 'loglevel';
import path from 'path';
import fsExtra from 'fs-extra';
import { fileURLToPath } from 'url';
import prompts from 'prompts';
import { execa, execaSync } from 'execa';
import crypto from 'crypto';
import ora from 'ora';
import dns from 'dns';
import http from 'http';
import { promisify } from 'util';
import fs from 'fs';
import updateNotifier from 'update-notifier';
import axios from 'axios';
import { dir } from 'tmp-promise';
import { fileTypeFromBuffer } from 'file-type';
import icongen from 'icon-gen';
import sharp from 'sharp';
import * as psl from 'psl';

var name = "pake-cli";
var version = "3.3.5";
var description = "🤱🏻 Turn any webpage into a desktop app with one command. 🤱🏻 一键打包网页生成轻量桌面应用。";
var engines = {
	node: ">=18.0.0"
};
var packageManager = "pnpm@10.15.0";
var bin = {
	pake: "./dist/cli.js"
};
var repository = {
	type: "git",
	url: "https://github.com/tw93/pake.git"
};
var author = {
	name: "Tw93",
	email: "tw93@qq.com"
};
var keywords = [
	"pake",
	"pake-cli",
	"rust",
	"tauri",
	"no-electron",
	"productivity"
];
var files = [
	"dist",
	"src-tauri"
];
var scripts = {
	start: "pnpm run dev",
	dev: "pnpm run tauri dev",
	build: "tauri build",
	"build:debug": "tauri build --debug",
	"build:mac": "tauri build --target universal-apple-darwin",
	"build:config": "chmod +x scripts/configure-tauri.mjs && node scripts/configure-tauri.mjs",
	analyze: "cd src-tauri && cargo bloat --release --crates",
	tauri: "tauri",
	cli: "cross-env NODE_ENV=development rollup -c -w",
	"cli:build": "cross-env NODE_ENV=production rollup -c",
	test: "pnpm run cli:build && cross-env PAKE_CREATE_APP=1 node tests/index.js",
	format: "prettier --write . --ignore-unknown && find tests -name '*.js' -exec sed -i '' 's/[[:space:]]*$//' {} \\; && cd src-tauri && cargo fmt --verbose",
	"format:check": "prettier --check . --ignore-unknown",
	update: "pnpm update --verbose && cd src-tauri && cargo update",
	prepublishOnly: "pnpm run cli:build"
};
var type = "module";
var exports = "./dist/cli.js";
var license = "MIT";
var dependencies = {
	"@tauri-apps/api": "^2.8.0",
	"@tauri-apps/cli": "^2.8.4",
	axios: "^1.11.0",
	chalk: "^5.6.0",
	commander: "^12.1.0",
	execa: "^9.6.0",
	"file-type": "^18.7.0",
	"fs-extra": "^11.3.1",
	"icon-gen": "^5.0.0",
	loglevel: "^1.9.2",
	ora: "^8.2.0",
	prompts: "^2.4.2",
	psl: "^1.15.0",
	sharp: "^0.33.5",
	"tmp-promise": "^3.0.3",
	"update-notifier": "^7.3.1"
};
var devDependencies = {
	"@rollup/plugin-alias": "^5.1.1",
	"@rollup/plugin-commonjs": "^28.0.6",
	"@rollup/plugin-json": "^6.1.0",
	"@rollup/plugin-replace": "^6.0.2",
	"@rollup/plugin-terser": "^0.4.4",
	"@types/fs-extra": "^11.0.4",
	"@types/node": "^20.19.13",
	"@types/page-icon": "^0.3.6",
	"@types/prompts": "^2.4.9",
	"@types/tmp": "^0.2.6",
	"@types/update-notifier": "^6.0.8",
	"app-root-path": "^3.1.0",
	"cross-env": "^7.0.3",
	prettier: "^3.6.2",
	rollup: "^4.50.0",
	"rollup-plugin-typescript2": "^0.36.0",
	tslib: "^2.8.1",
	typescript: "^5.9.2"
};
var packageJson = {
	name: name,
	version: version,
	description: description,
	engines: engines,
	packageManager: packageManager,
	bin: bin,
	repository: repository,
	author: author,
	keywords: keywords,
	files: files,
	scripts: scripts,
	type: type,
	exports: exports,
	license: license,
	dependencies: dependencies,
	devDependencies: devDependencies
};

// Convert the current module URL to a file path
const currentModulePath = fileURLToPath(import.meta.url);
// Resolve the parent directory of the current module
const npmDirectory = path.join(path.dirname(currentModulePath), '..');
const tauriConfigDirectory = path.join(npmDirectory, 'src-tauri', '.pake');

// Load configs from npm package directory, not from project source
const tauriSrcDir = path.join(npmDirectory, 'src-tauri');
const pakeConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'pake.json'));
const CommonConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.conf.json'));
const WinConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.windows.conf.json'));
const MacConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.macos.conf.json'));
const LinuxConf = fsExtra.readJSONSync(path.join(tauriSrcDir, 'tauri.linux.conf.json'));
const platformConfigs = {
    win32: WinConf,
    darwin: MacConf,
    linux: LinuxConf,
};
const { platform: platform$2 } = process;
// @ts-ignore
const platformConfig = platformConfigs[platform$2];
let tauriConfig = {
    ...CommonConf,
    bundle: platformConfig.bundle,
    app: {
        ...CommonConf.app,
        trayIcon: {
            ...(platformConfig?.app?.trayIcon ?? {}),
        },
    },
    build: CommonConf.build,
    pake: pakeConf,
};

// Generates an identifier based on the given URL.
function getIdentifier(url) {
    const postFixHash = crypto
        .createHash('md5')
        .update(url)
        .digest('hex')
        .substring(0, 6);
    return `com.pake.${postFixHash}`;
}
async function promptText(message, initial) {
    const response = await prompts({
        type: 'text',
        name: 'content',
        message,
        initial,
    });
    return response.content;
}
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
function getSpinner(text) {
    const loadingType = {
        interval: 80,
        frames: ['✦', '✶', '✺', '✵', '✸', '✹', '✺'],
    };
    return ora({
        text: `${chalk.cyan(text)}\n`,
        spinner: loadingType,
        color: 'cyan',
    }).start();
}

const { platform: platform$1 } = process;
const IS_MAC = platform$1 === 'darwin';
const IS_WIN = platform$1 === 'win32';
const IS_LINUX = platform$1 === 'linux';

async function shellExec(command, timeout = 300000, env) {
    try {
        const { exitCode } = await execa(command, {
            cwd: npmDirectory,
            stdio: ['inherit', 'pipe', 'inherit'], // Hide stdout verbose, keep stderr
            shell: true,
            timeout,
            env: env ? { ...process.env, ...env } : process.env,
        });
        return exitCode;
    }
    catch (error) {
        const exitCode = error.exitCode ?? 'unknown';
        const errorMessage = error.message || 'Unknown error occurred';
        if (error.timedOut) {
            throw new Error(`Command timed out after ${timeout}ms: "${command}". Try increasing timeout or check network connectivity.`);
        }
        throw new Error(`Error occurred while executing command "${command}". Exit code: ${exitCode}. Details: ${errorMessage}`);
    }
}

const logger = {
    info(...msg) {
        log.info(...msg.map((m) => chalk.white(m)));
    },
    debug(...msg) {
        log.debug(...msg);
    },
    error(...msg) {
        log.error(...msg.map((m) => chalk.red(m)));
    },
    warn(...msg) {
        log.info(...msg.map((m) => chalk.yellow(m)));
    },
    success(...msg) {
        log.info(...msg.map((m) => chalk.green(m)));
    },
};

const resolve = promisify(dns.resolve);
const ping = async (host) => {
    const lookup = promisify(dns.lookup);
    const ip = await lookup(host);
    const start = new Date();
    // Prevent timeouts from affecting user experience.
    const requestPromise = new Promise((resolve, reject) => {
        const req = http.get(`http://${ip.address}`, (res) => {
            const delay = new Date().getTime() - start.getTime();
            res.resume();
            resolve(delay);
        });
        req.on('error', (err) => {
            reject(err);
        });
    });
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Request timed out after 3 seconds'));
        }, 1000);
    });
    return Promise.race([requestPromise, timeoutPromise]);
};
async function isChinaDomain(domain) {
    try {
        const [ip] = await resolve(domain);
        return await isChinaIP(ip, domain);
    }
    catch (error) {
        logger.debug(`${domain} can't be parse!`);
        return true;
    }
}
async function isChinaIP(ip, domain) {
    try {
        const delay = await ping(ip);
        logger.debug(`${domain} latency is ${delay} ms`);
        return delay > 1000;
    }
    catch (error) {
        logger.debug(`ping ${domain} failed!`);
        return true;
    }
}

async function installRust() {
    const isActions = process.env.GITHUB_ACTIONS;
    const isInChina = await isChinaDomain('sh.rustup.rs');
    const rustInstallScriptForMac = isInChina && !isActions
        ? 'export RUSTUP_DIST_SERVER="https://rsproxy.cn" && export RUSTUP_UPDATE_ROOT="https://rsproxy.cn/rustup" && curl --proto "=https" --tlsv1.2 -sSf https://rsproxy.cn/rustup-init.sh | sh'
        : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y";
    const rustInstallScriptForWindows = 'winget install --id Rustlang.Rustup';
    const spinner = getSpinner('Downloading Rust...');
    try {
        await shellExec(IS_WIN ? rustInstallScriptForWindows : rustInstallScriptForMac);
        spinner.succeed(chalk.green('✔ Rust installed successfully!'));
    }
    catch (error) {
        spinner.fail(chalk.red('✕ Rust installation failed!'));
        console.error(error.message);
        process.exit(1);
    }
}
function checkRustInstalled() {
    try {
        execaSync('rustc', ['--version']);
        return true;
    }
    catch {
        return false;
    }
}

async function combineFiles(files, output) {
    const contents = files.map((file) => {
        const fileContent = fs.readFileSync(file);
        if (file.endsWith('.css')) {
            return ("window.addEventListener('DOMContentLoaded', (_event) => { const css = `" +
                fileContent +
                "`; const style = document.createElement('style'); style.innerHTML = css; document.head.appendChild(style); });");
        }
        return ("window.addEventListener('DOMContentLoaded', (_event) => { " +
            fileContent +
            ' });');
    });
    fs.writeFileSync(output, contents.join('\n'));
    return files;
}

async function mergeConfig(url, options, tauriConf) {
    // Ensure .pake directory exists and copy source templates if needed
    const srcTauriDir = path.join(npmDirectory, 'src-tauri');
    await fsExtra.ensureDir(tauriConfigDirectory);
    // Copy source config files to .pake directory (as templates)
    const sourceFiles = [
        'tauri.conf.json',
        'tauri.macos.conf.json',
        'tauri.windows.conf.json',
        'tauri.linux.conf.json',
        'pake.json',
    ];
    await Promise.all(sourceFiles.map(async (file) => {
        const sourcePath = path.join(srcTauriDir, file);
        const destPath = path.join(tauriConfigDirectory, file);
        if ((await fsExtra.pathExists(sourcePath)) &&
            !(await fsExtra.pathExists(destPath))) {
            await fsExtra.copy(sourcePath, destPath);
        }
    }));
    const { width, height, fullscreen, hideTitleBar, alwaysOnTop, appVersion, darkMode, disabledWebShortcuts, activationShortcut, userAgent, showSystemTray, systemTrayIcon, useLocalFile, identifier, name, resizable = true, inject, proxyUrl, installerLanguage, hideOnClose, incognito, title, wasm, enableDragDrop, } = options;
    const { platform } = process;
    const platformHideOnClose = hideOnClose ?? platform === 'darwin';
    const tauriConfWindowOptions = {
        width,
        height,
        fullscreen,
        resizable,
        hide_title_bar: hideTitleBar,
        activation_shortcut: activationShortcut,
        always_on_top: alwaysOnTop,
        dark_mode: darkMode,
        disabled_web_shortcuts: disabledWebShortcuts,
        hide_on_close: platformHideOnClose,
        incognito: incognito,
        title: title || null,
        enable_wasm: wasm,
        enable_drag_drop: enableDragDrop,
    };
    Object.assign(tauriConf.pake.windows[0], { url, ...tauriConfWindowOptions });
    tauriConf.productName = name;
    tauriConf.identifier = identifier;
    tauriConf.version = appVersion;
    if (platform === 'linux') {
        tauriConf.mainBinaryName = `pake-${name.toLowerCase()}`;
    }
    if (platform == 'win32') {
        tauriConf.bundle.windows.wix.language[0] = installerLanguage;
    }
    const pathExists = await fsExtra.pathExists(url);
    if (pathExists) {
        logger.warn('✼ Your input might be a local file.');
        tauriConf.pake.windows[0].url_type = 'local';
        const fileName = path.basename(url);
        const dirName = path.dirname(url);
        const distDir = path.join(npmDirectory, 'dist');
        const distBakDir = path.join(npmDirectory, 'dist_bak');
        if (!useLocalFile) {
            const urlPath = path.join(distDir, fileName);
            await fsExtra.copy(url, urlPath);
        }
        else {
            fsExtra.moveSync(distDir, distBakDir, { overwrite: true });
            fsExtra.copySync(dirName, distDir, { overwrite: true });
            // ignore it, because about_pake.html have be erased.
            // const filesToCopyBack = ['cli.js', 'about_pake.html'];
            const filesToCopyBack = ['cli.js'];
            await Promise.all(filesToCopyBack.map((file) => fsExtra.copy(path.join(distBakDir, file), path.join(distDir, file))));
        }
        tauriConf.pake.windows[0].url = fileName;
        tauriConf.pake.windows[0].url_type = 'local';
    }
    else {
        tauriConf.pake.windows[0].url_type = 'web';
    }
    const platformMap = {
        win32: 'windows',
        linux: 'linux',
        darwin: 'macos',
    };
    const currentPlatform = platformMap[platform];
    if (userAgent.length > 0) {
        tauriConf.pake.user_agent[currentPlatform] = userAgent;
    }
    tauriConf.pake.system_tray[currentPlatform] = showSystemTray;
    // Processing targets are currently only open to Linux.
    if (platform === 'linux') {
        // Remove hardcoded desktop files and regenerate with correct app name
        delete tauriConf.bundle.linux.deb.files;
        // Generate correct desktop file configuration
        const appNameLower = name.toLowerCase();
        const identifier = `com.pake.${appNameLower}`;
        const desktopFileName = `${identifier}.desktop`;
        // Create desktop file content
        const desktopContent = `[Desktop Entry]
Version=1.0
Type=Application
Name=${name}
Comment=${name}
Exec=pake-${appNameLower}
Icon=${appNameLower}_512
Categories=Network;WebBrowser;
MimeType=text/html;text/xml;application/xhtml_xml;
StartupNotify=true
`;
        // Write desktop file to src-tauri/assets directory where Tauri expects it
        const srcAssetsDir = path.join(npmDirectory, 'src-tauri/assets');
        const srcDesktopFilePath = path.join(srcAssetsDir, desktopFileName);
        await fsExtra.ensureDir(srcAssetsDir);
        await fsExtra.writeFile(srcDesktopFilePath, desktopContent);
        // Set up desktop file in bundle configuration
        // Use absolute path from src-tauri directory to assets
        tauriConf.bundle.linux.deb.files = {
            [`/usr/share/applications/${desktopFileName}`]: `assets/${desktopFileName}`,
        };
        const validTargets = [
            'deb',
            'appimage',
            'rpm',
            'deb-arm64',
            'appimage-arm64',
            'rpm-arm64',
        ];
        const baseTarget = options.targets.includes('-arm64')
            ? options.targets.replace('-arm64', '')
            : options.targets;
        if (validTargets.includes(options.targets)) {
            tauriConf.bundle.targets = [baseTarget];
        }
        else {
            logger.warn(`✼ The target must be one of ${validTargets.join(', ')}, the default 'deb' will be used.`);
        }
    }
    // Set macOS bundle targets (for app vs dmg)
    if (platform === 'darwin') {
        const validMacTargets = ['app', 'dmg'];
        if (validMacTargets.includes(options.targets)) {
            tauriConf.bundle.targets = [options.targets];
        }
    }
    // Set icon.
    const platformIconMap = {
        win32: {
            fileExt: '.ico',
            path: `png/${name.toLowerCase()}_256.ico`,
            defaultIcon: 'png/icon_256.ico',
            message: 'Windows icon must be .ico and 256x256px.',
        },
        linux: {
            fileExt: '.png',
            path: `png/${name.toLowerCase()}_512.png`,
            defaultIcon: 'png/icon_512.png',
            message: 'Linux icon must be .png and 512x512px.',
        },
        darwin: {
            fileExt: '.icns',
            path: `icons/${name.toLowerCase()}.icns`,
            defaultIcon: 'icons/icon.icns',
            message: 'macOS icon must be .icns type.',
        },
    };
    const iconInfo = platformIconMap[platform];
    const exists = options.icon && (await fsExtra.pathExists(options.icon));
    if (exists) {
        let updateIconPath = true;
        let customIconExt = path.extname(options.icon).toLowerCase();
        if (customIconExt !== iconInfo.fileExt) {
            updateIconPath = false;
            logger.warn(`✼ ${iconInfo.message}, but you give ${customIconExt}`);
            tauriConf.bundle.icon = [iconInfo.defaultIcon];
        }
        else {
            const iconPath = path.join(npmDirectory, 'src-tauri/', iconInfo.path);
            tauriConf.bundle.resources = [iconInfo.path];
            // Avoid copying if source and destination are the same
            const absoluteIconPath = path.resolve(options.icon);
            const absoluteDestPath = path.resolve(iconPath);
            if (absoluteIconPath !== absoluteDestPath) {
                await fsExtra.copy(options.icon, iconPath);
            }
        }
        if (updateIconPath) {
            tauriConf.bundle.icon = [iconInfo.path];
        }
        else {
            logger.warn(`✼ Icon will remain as default.`);
        }
    }
    else {
        logger.warn('✼ Custom icon path may be invalid, default icon will be used instead.');
        tauriConf.bundle.icon = [iconInfo.defaultIcon];
    }
    // Set tray icon path.
    let trayIconPath = platform === 'darwin' ? 'png/icon_512.png' : tauriConf.bundle.icon[0];
    if (systemTrayIcon.length > 0) {
        try {
            await fsExtra.pathExists(systemTrayIcon);
            // 需要判断图标格式，默认只支持ico和png两种
            let iconExt = path.extname(systemTrayIcon).toLowerCase();
            if (iconExt == '.png' || iconExt == '.ico') {
                const trayIcoPath = path.join(npmDirectory, `src-tauri/png/${name.toLowerCase()}${iconExt}`);
                trayIconPath = `png/${name.toLowerCase()}${iconExt}`;
                await fsExtra.copy(systemTrayIcon, trayIcoPath);
            }
            else {
                logger.warn(`✼ System tray icon must be .ico or .png, but you provided ${iconExt}.`);
                logger.warn(`✼ Default system tray icon will be used.`);
            }
        }
        catch {
            logger.warn(`✼ ${systemTrayIcon} not exists!`);
            logger.warn(`✼ Default system tray icon will remain unchanged.`);
        }
    }
    tauriConf.app.trayIcon.iconPath = trayIconPath;
    tauriConf.pake.system_tray_path = trayIconPath;
    delete tauriConf.app.trayIcon;
    const injectFilePath = path.join(npmDirectory, `src-tauri/src/inject/custom.js`);
    // inject js or css files
    if (inject?.length > 0) {
        // Ensure inject is an array before calling .every()
        const injectArray = Array.isArray(inject) ? inject : [inject];
        if (!injectArray.every((item) => item.endsWith('.css') || item.endsWith('.js'))) {
            logger.error('The injected file must be in either CSS or JS format.');
            return;
        }
        const files = injectArray.map((filepath) => path.isAbsolute(filepath) ? filepath : path.join(process.cwd(), filepath));
        tauriConf.pake.inject = files;
        await combineFiles(files, injectFilePath);
    }
    else {
        tauriConf.pake.inject = [];
        await fsExtra.writeFile(injectFilePath, '');
    }
    tauriConf.pake.proxy_url = proxyUrl || '';
    // Configure WASM support with required HTTP headers
    if (wasm) {
        tauriConf.app.security = {
            headers: {
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            },
        };
    }
    // Save config file.
    const platformConfigPaths = {
        win32: 'tauri.windows.conf.json',
        darwin: 'tauri.macos.conf.json',
        linux: 'tauri.linux.conf.json',
    };
    const configPath = path.join(tauriConfigDirectory, platformConfigPaths[platform]);
    const bundleConf = { bundle: tauriConf.bundle };
    await fsExtra.outputJSON(configPath, bundleConf, { spaces: 4 });
    const pakeConfigPath = path.join(tauriConfigDirectory, 'pake.json');
    await fsExtra.outputJSON(pakeConfigPath, tauriConf.pake, { spaces: 4 });
    let tauriConf2 = JSON.parse(JSON.stringify(tauriConf));
    delete tauriConf2.pake;
    const configJsonPath = path.join(tauriConfigDirectory, 'tauri.conf.json');
    await fsExtra.outputJSON(configJsonPath, tauriConf2, { spaces: 4 });
}

class BaseBuilder {
    constructor(options) {
        this.options = options;
    }
    getBuildEnvironment() {
        return IS_MAC
            ? {
                CFLAGS: '-fno-modules',
                CXXFLAGS: '-fno-modules',
                MACOSX_DEPLOYMENT_TARGET: '14.0',
            }
            : undefined;
    }
    getInstallTimeout() {
        return process.platform === 'win32' ? 600000 : 300000;
    }
    getBuildTimeout() {
        return 900000;
    }
    async detectPackageManager() {
        if (BaseBuilder.packageManagerCache) {
            return BaseBuilder.packageManagerCache;
        }
        const { execa } = await import('execa');
        try {
            await execa('pnpm', ['--version'], { stdio: 'ignore' });
            logger.info('✺ Using pnpm for package management.');
            BaseBuilder.packageManagerCache = 'pnpm';
            return 'pnpm';
        }
        catch {
            try {
                await execa('npm', ['--version'], { stdio: 'ignore' });
                logger.info('✺ pnpm not available, using npm for package management.');
                BaseBuilder.packageManagerCache = 'npm';
                return 'npm';
            }
            catch {
                throw new Error('Neither pnpm nor npm is available. Please install a package manager.');
            }
        }
    }
    async prepare() {
        const tauriSrcPath = path.join(npmDirectory, 'src-tauri');
        const tauriTargetPath = path.join(tauriSrcPath, 'target');
        const tauriTargetPathExists = await fsExtra.pathExists(tauriTargetPath);
        if (!IS_MAC && !tauriTargetPathExists) {
            logger.warn('✼ The first use requires installing system dependencies.');
            logger.warn('✼ See more in https://tauri.app/start/prerequisites/.');
        }
        if (!checkRustInstalled()) {
            const res = await prompts({
                type: 'confirm',
                message: 'Rust not detected. Install now?',
                name: 'value',
            });
            if (res.value) {
                await installRust();
            }
            else {
                logger.error('✕ Rust required to package your webapp.');
                process.exit(0);
            }
        }
        const isChina = await isChinaDomain('www.npmjs.com');
        const spinner = getSpinner('Installing package...');
        const rustProjectDir = path.join(tauriSrcPath, '.cargo');
        const projectConf = path.join(rustProjectDir, 'config.toml');
        await fsExtra.ensureDir(rustProjectDir);
        // 智能检测可用的包管理器
        const packageManager = await this.detectPackageManager();
        const registryOption = isChina
            ? ' --registry=https://registry.npmmirror.com'
            : '';
        // 根据包管理器类型设置依赖冲突解决选项
        const peerDepsOption = packageManager === 'npm' ? ' --legacy-peer-deps' : '';
        const timeout = this.getInstallTimeout();
        const buildEnv = this.getBuildEnvironment();
        if (isChina) {
            logger.info(`✺ Located in China, using ${packageManager}/rsProxy CN mirror.`);
            const projectCnConf = path.join(tauriSrcPath, 'rust_proxy.toml');
            await fsExtra.copy(projectCnConf, projectConf);
            await shellExec(`cd "${npmDirectory}" && ${packageManager} install${registryOption}${peerDepsOption} --silent`, timeout, buildEnv);
        }
        else {
            await shellExec(`cd "${npmDirectory}" && ${packageManager} install${peerDepsOption} --silent`, timeout, buildEnv);
        }
        spinner.succeed(chalk.green('Package installed!'));
        if (!tauriTargetPathExists) {
            logger.warn('✼ The first packaging may be slow, please be patient and wait, it will be faster afterwards.');
        }
    }
    async build(url) {
        await this.buildAndCopy(url, this.options.targets);
    }
    async start(url) {
        await mergeConfig(url, this.options, tauriConfig);
    }
    async buildAndCopy(url, target) {
        const { name } = this.options;
        await mergeConfig(url, this.options, tauriConfig);
        // Detect available package manager
        const packageManager = await this.detectPackageManager();
        // Build app
        const buildSpinner = getSpinner('Building app...');
        // Let spinner run for a moment so user can see it, then stop before package manager command
        await new Promise((resolve) => setTimeout(resolve, 500));
        buildSpinner.stop();
        // Show static message to keep the status visible
        logger.warn('✸ Building app...');
        const buildEnv = this.getBuildEnvironment();
        await shellExec(`cd "${npmDirectory}" && ${this.getBuildCommand(packageManager)}`, this.getBuildTimeout(), buildEnv);
        // Copy app
        const fileName = this.getFileName();
        const fileType = this.getFileType(target);
        const appPath = this.getBuildAppPath(npmDirectory, fileName, fileType);
        const distPath = path.resolve(`${name}.${fileType}`);
        await fsExtra.copy(appPath, distPath);
        // Copy raw binary if requested
        if (this.options.keepBinary) {
            await this.copyRawBinary(npmDirectory, name);
        }
        await fsExtra.remove(appPath);
        logger.success('✔ Build success!');
        logger.success('✔ App installer located in', distPath);
        // Log binary location if preserved
        if (this.options.keepBinary) {
            const binaryPath = this.getRawBinaryPath(name);
            logger.success('✔ Raw binary located in', path.resolve(binaryPath));
        }
    }
    getFileType(target) {
        return target;
    }
    /**
     * 解析目标架构
     */
    resolveTargetArch(requestedArch) {
        if (requestedArch === 'auto' || !requestedArch) {
            return process.arch;
        }
        return requestedArch;
    }
    /**
     * 获取Tauri构建目标
     */
    getTauriTarget(arch, platform = process.platform) {
        const platformMappings = BaseBuilder.ARCH_MAPPINGS[platform];
        if (!platformMappings)
            return null;
        return platformMappings[arch] || null;
    }
    /**
     * 获取架构显示名称（用于文件名）
     */
    getArchDisplayName(arch) {
        return BaseBuilder.ARCH_DISPLAY_NAMES[arch] || arch;
    }
    /**
     * 构建基础构建命令
     */
    buildBaseCommand(packageManager, configPath, target) {
        const baseCommand = this.options.debug
            ? `${packageManager} run build:debug`
            : `${packageManager} run build`;
        const argSeparator = packageManager === 'npm' ? ' --' : '';
        let fullCommand = `${baseCommand}${argSeparator} -c "${configPath}"`;
        if (target) {
            fullCommand += ` --target ${target}`;
        }
        return fullCommand;
    }
    /**
     * 获取构建特性列表
     */
    getBuildFeatures() {
        const features = ['cli-build'];
        // Add macos-proxy feature for modern macOS (Darwin 23+ = macOS 14+)
        if (IS_MAC) {
            const macOSVersion = this.getMacOSMajorVersion();
            if (macOSVersion >= 23) {
                features.push('macos-proxy');
            }
        }
        return features;
    }
    getBuildCommand(packageManager = 'pnpm') {
        // Use temporary config directory to avoid modifying source files
        const configPath = path.join(npmDirectory, 'src-tauri', '.pake', 'tauri.conf.json');
        let fullCommand = this.buildBaseCommand(packageManager, configPath);
        // For macOS, use app bundles by default unless DMG is explicitly requested
        if (IS_MAC && this.options.targets === 'app') {
            fullCommand += ' --bundles app';
        }
        // Add features
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getMacOSMajorVersion() {
        try {
            const os = require('os');
            const release = os.release();
            const majorVersion = parseInt(release.split('.')[0], 10);
            return majorVersion;
        }
        catch (error) {
            return 0; // Disable proxy feature if version detection fails
        }
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        return `src-tauri/target/${basePath}/bundle/`;
    }
    getBuildAppPath(npmDirectory, fileName, fileType) {
        // For app bundles on macOS, the directory is 'macos', not 'app'
        const bundleDir = fileType.toLowerCase() === 'app' ? 'macos' : fileType.toLowerCase();
        return path.join(npmDirectory, this.getBasePath(), bundleDir, `${fileName}.${fileType}`);
    }
    /**
     * Copy raw binary file to output directory
     */
    async copyRawBinary(npmDirectory, appName) {
        const binaryPath = this.getRawBinarySourcePath(npmDirectory, appName);
        const outputPath = this.getRawBinaryPath(appName);
        if (await fsExtra.pathExists(binaryPath)) {
            await fsExtra.copy(binaryPath, outputPath);
            // Make binary executable on Unix-like systems
            if (process.platform !== 'win32') {
                await fsExtra.chmod(outputPath, 0o755);
            }
        }
        else {
            logger.warn(`✼ Raw binary not found at ${binaryPath}, skipping...`);
        }
    }
    /**
     * Get the source path of the raw binary file in the build directory
     */
    getRawBinarySourcePath(npmDirectory, appName) {
        const basePath = this.options.debug ? 'debug' : 'release';
        const binaryName = this.getBinaryName(appName);
        // Handle cross-platform builds
        if (this.options.multiArch || this.hasArchSpecificTarget()) {
            return path.join(npmDirectory, this.getArchSpecificPath(), basePath, binaryName);
        }
        return path.join(npmDirectory, 'src-tauri/target', basePath, binaryName);
    }
    /**
     * Get the output path for the raw binary file
     */
    getRawBinaryPath(appName) {
        const extension = process.platform === 'win32' ? '.exe' : '';
        const suffix = process.platform === 'win32' ? '' : '-binary';
        return `${appName}${suffix}${extension}`;
    }
    /**
     * Get the binary name based on app name and platform
     */
    getBinaryName(appName) {
        const extension = process.platform === 'win32' ? '.exe' : '';
        // Linux uses the unique binary name we set in merge.ts
        if (process.platform === 'linux') {
            return `pake-${appName.toLowerCase()}${extension}`;
        }
        // Windows and macOS use 'pake' as binary name
        return `pake${extension}`;
    }
    /**
     * Check if this build has architecture-specific target
     */
    hasArchSpecificTarget() {
        return false; // Override in subclasses if needed
    }
    /**
     * Get architecture-specific path for binary
     */
    getArchSpecificPath() {
        return 'src-tauri/target'; // Override in subclasses if needed
    }
}
BaseBuilder.packageManagerCache = null;
// 架构映射配置
BaseBuilder.ARCH_MAPPINGS = {
    darwin: {
        arm64: 'aarch64-apple-darwin',
        x64: 'x86_64-apple-darwin',
        universal: 'universal-apple-darwin',
    },
    win32: {
        arm64: 'aarch64-pc-windows-msvc',
        x64: 'x86_64-pc-windows-msvc',
    },
    linux: {
        arm64: 'aarch64-unknown-linux-gnu',
        x64: 'x86_64-unknown-linux-gnu',
    },
};
// 架构名称映射（用于文件名生成）
BaseBuilder.ARCH_DISPLAY_NAMES = {
    arm64: 'aarch64',
    x64: 'x64',
    universal: 'universal',
};

class MacBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        const validArchs = ['intel', 'apple', 'universal', 'auto', 'x64', 'arm64'];
        this.buildArch = validArchs.includes(options.targets || '')
            ? options.targets
            : 'auto';
        if (process.env.PAKE_CREATE_APP === '1') {
            this.buildFormat = 'app';
        }
        else {
            this.buildFormat = 'dmg';
        }
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name } = this.options;
        if (this.buildFormat === 'app') {
            return name;
        }
        let arch;
        if (this.buildArch === 'universal' || this.options.multiArch) {
            arch = 'universal';
        }
        else if (this.buildArch === 'apple') {
            arch = 'aarch64';
        }
        else if (this.buildArch === 'intel') {
            arch = 'x64';
        }
        else {
            arch = this.getArchDisplayName(this.resolveTargetArch(this.buildArch));
        }
        return `${name}_${tauriConfig.version}_${arch}`;
    }
    getActualArch() {
        if (this.buildArch === 'universal' || this.options.multiArch) {
            return 'universal';
        }
        else if (this.buildArch === 'apple') {
            return 'arm64';
        }
        else if (this.buildArch === 'intel') {
            return 'x64';
        }
        return this.resolveTargetArch(this.buildArch);
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const actualArch = this.getActualArch();
        const buildTarget = this.getTauriTarget(actualArch, 'darwin');
        if (!buildTarget) {
            throw new Error(`Unsupported architecture: ${actualArch} for macOS`);
        }
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        const actualArch = this.getActualArch();
        const target = this.getTauriTarget(actualArch, 'darwin');
        return `src-tauri/target/${target}/${basePath}/bundle`;
    }
    hasArchSpecificTarget() {
        return true;
    }
    getArchSpecificPath() {
        const actualArch = this.getActualArch();
        const target = this.getTauriTarget(actualArch, 'darwin');
        return `src-tauri/target/${target}`;
    }
}

class WinBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        this.buildFormat = 'msi';
        const validArchs = ['x64', 'arm64', 'auto'];
        this.buildArch = validArchs.includes(options.targets || '')
            ? this.resolveTargetArch(options.targets)
            : this.resolveTargetArch('auto');
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name } = this.options;
        const language = tauriConfig.bundle.windows.wix.language[0];
        const targetArch = this.getArchDisplayName(this.buildArch);
        return `${name}_${tauriConfig.version}_${targetArch}_${language}`;
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const buildTarget = this.getTauriTarget(this.buildArch, 'win32');
        if (!buildTarget) {
            throw new Error(`Unsupported architecture: ${this.buildArch} for Windows`);
        }
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        const target = this.getTauriTarget(this.buildArch, 'win32');
        return `src-tauri/target/${target}/${basePath}/bundle/`;
    }
    hasArchSpecificTarget() {
        return true;
    }
    getArchSpecificPath() {
        const target = this.getTauriTarget(this.buildArch, 'win32');
        return `src-tauri/target/${target}`;
    }
}

class LinuxBuilder extends BaseBuilder {
    constructor(options) {
        super(options);
        const target = options.targets || 'deb';
        if (target.includes('-arm64')) {
            this.buildFormat = target.replace('-arm64', '');
            this.buildArch = 'arm64';
        }
        else {
            this.buildFormat = target;
            this.buildArch = this.resolveTargetArch('auto');
        }
        this.options.targets = this.buildFormat;
    }
    getFileName() {
        const { name, targets } = this.options;
        const version = tauriConfig.version;
        let arch;
        if (this.buildArch === 'arm64') {
            arch = targets === 'rpm' || targets === 'appimage' ? 'aarch64' : 'arm64';
        }
        else {
            if (this.buildArch === 'x64') {
                arch = targets === 'rpm' ? 'x86_64' : 'amd64';
            }
            else {
                arch = this.buildArch;
                if (this.buildArch === 'arm64' &&
                    (targets === 'rpm' || targets === 'appimage')) {
                    arch = 'aarch64';
                }
            }
        }
        if (targets === 'rpm') {
            return `${name}-${version}-1.${arch}`;
        }
        return `${name}_${version}_${arch}`;
    }
    async build(url) {
        const targetTypes = ['deb', 'appimage', 'rpm'];
        for (const target of targetTypes) {
            if (this.options.targets === target) {
                await this.buildAndCopy(url, target);
            }
        }
    }
    getBuildCommand(packageManager = 'pnpm') {
        const configPath = path.join('src-tauri', '.pake', 'tauri.conf.json');
        const buildTarget = this.buildArch === 'arm64'
            ? this.getTauriTarget(this.buildArch, 'linux')
            : undefined;
        let fullCommand = this.buildBaseCommand(packageManager, configPath, buildTarget);
        const features = this.getBuildFeatures();
        if (features.length > 0) {
            fullCommand += ` --features ${features.join(',')}`;
        }
        return fullCommand;
    }
    getBasePath() {
        const basePath = this.options.debug ? 'debug' : 'release';
        if (this.buildArch === 'arm64') {
            const target = this.getTauriTarget(this.buildArch, 'linux');
            return `src-tauri/target/${target}/${basePath}/bundle/`;
        }
        return super.getBasePath();
    }
    getFileType(target) {
        if (target === 'appimage') {
            return 'AppImage';
        }
        return super.getFileType(target);
    }
    hasArchSpecificTarget() {
        return this.buildArch === 'arm64';
    }
    getArchSpecificPath() {
        if (this.buildArch === 'arm64') {
            const target = this.getTauriTarget(this.buildArch, 'linux');
            return `src-tauri/target/${target}`;
        }
        return super.getArchSpecificPath();
    }
}

const { platform } = process;
const buildersMap = {
    darwin: MacBuilder,
    win32: WinBuilder,
    linux: LinuxBuilder,
};
class BuilderProvider {
    static create(options) {
        const Builder = buildersMap[platform];
        if (!Builder) {
            throw new Error('The current system is not supported!');
        }
        return new Builder(options);
    }
}

const DEFAULT_PAKE_OPTIONS = {
    icon: '',
    height: 780,
    width: 1200,
    fullscreen: false,
    hideTitleBar: false,
    alwaysOnTop: false,
    appVersion: '1.0.0',
    darkMode: false,
    disabledWebShortcuts: false,
    activationShortcut: '',
    userAgent: '',
    showSystemTray: false,
    multiArch: false,
    targets: 'deb',
    useLocalFile: false,
    systemTrayIcon: '',
    proxyUrl: '',
    debug: false,
    inject: [],
    installerLanguage: 'en-US',
    hideOnClose: undefined, // Platform-specific: true for macOS, false for others
    incognito: false,
    wasm: false,
    enableDragDrop: false,
    keepBinary: false,
};

async function checkUpdateTips() {
    updateNotifier({ pkg: packageJson, updateCheckInterval: 1000 * 60 }).notify({
        isGlobal: true,
    });
}

const ICON_CONFIG = {
    minFileSize: 100,
    supportedFormats: ['png', 'ico', 'jpeg', 'jpg', 'webp', 'icns'],
    whiteBackground: { r: 255, g: 255, b: 255 },
    transparentBackground: { r: 255, g: 255, b: 255, alpha: 0 },
    downloadTimeout: {
        ci: 5000,
        default: 15000,
    },
};
const PLATFORM_CONFIG = {
    win: { format: '.ico', sizes: [16, 32, 48, 64, 128, 256] },
    linux: { format: '.png', size: 512 },
    macos: { format: '.icns', sizes: [16, 32, 64, 128, 256, 512, 1024] },
};
const API_KEYS = {
    logoDev: ['pk_JLLMUKGZRpaG5YclhXaTkg', 'pk_Ph745P8mQSeYFfW2Wk039A'],
    brandfetch: ['1idqvJC0CeFSeyp3Yf7', '1idej-yhU_ThggIHFyG'],
};
/**
 * Generates platform-specific icon paths and handles copying for Windows
 */
function generateIconPath(appName, isDefault = false) {
    const safeName = appName.toLowerCase().replace(/[^a-z0-9-_]/g, '_');
    const baseName = isDefault ? 'icon' : safeName;
    if (IS_WIN) {
        return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_256.ico`);
    }
    if (IS_LINUX) {
        return path.join(npmDirectory, 'src-tauri', 'png', `${baseName}_512.png`);
    }
    return path.join(npmDirectory, 'src-tauri', 'icons', `${baseName}.icns`);
}
async function copyWindowsIconIfNeeded(convertedPath, appName) {
    if (!IS_WIN || !convertedPath.endsWith('.ico')) {
        return convertedPath;
    }
    try {
        const finalIconPath = generateIconPath(appName);
        await fsExtra.ensureDir(path.dirname(finalIconPath));
        await fsExtra.copy(convertedPath, finalIconPath);
        return finalIconPath;
    }
    catch (error) {
        logger.warn(`Failed to copy Windows icon: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return convertedPath;
    }
}
/**
 * Adds white background to transparent icons only
 */
async function preprocessIcon(inputPath) {
    try {
        const metadata = await sharp(inputPath).metadata();
        if (metadata.channels !== 4)
            return inputPath; // No transparency
        const { path: tempDir } = await dir();
        const outputPath = path.join(tempDir, 'icon-with-background.png');
        await sharp({
            create: {
                width: metadata.width || 512,
                height: metadata.height || 512,
                channels: 3,
                background: ICON_CONFIG.whiteBackground,
            },
        })
            .composite([{ input: inputPath }])
            .png()
            .toFile(outputPath);
        return outputPath;
    }
    catch (error) {
        logger.warn(`Failed to add background to icon: ${error.message}`);
        return inputPath;
    }
}
/**
 * Converts icon to platform-specific format
 */
async function convertIconFormat(inputPath, appName) {
    try {
        if (!(await fsExtra.pathExists(inputPath)))
            return null;
        const { path: outputDir } = await dir();
        const platformOutputDir = path.join(outputDir, 'converted-icons');
        await fsExtra.ensureDir(platformOutputDir);
        const processedInputPath = await preprocessIcon(inputPath);
        const iconName = appName.toLowerCase();
        // Generate platform-specific format
        if (IS_WIN) {
            // Support multiple sizes for better Windows compatibility
            await icongen(processedInputPath, platformOutputDir, {
                report: false,
                ico: {
                    name: `${iconName}_256`,
                    sizes: PLATFORM_CONFIG.win.sizes,
                },
            });
            return path.join(platformOutputDir, `${iconName}_256${PLATFORM_CONFIG.win.format}`);
        }
        if (IS_LINUX) {
            const outputPath = path.join(platformOutputDir, `${iconName}_${PLATFORM_CONFIG.linux.size}${PLATFORM_CONFIG.linux.format}`);
            // Ensure we convert to proper PNG format with correct size
            await sharp(processedInputPath)
                .resize(PLATFORM_CONFIG.linux.size, PLATFORM_CONFIG.linux.size, {
                fit: 'contain',
                background: ICON_CONFIG.transparentBackground,
            })
                .png()
                .toFile(outputPath);
            return outputPath;
        }
        // macOS
        await icongen(processedInputPath, platformOutputDir, {
            report: false,
            icns: { name: iconName, sizes: PLATFORM_CONFIG.macos.sizes },
        });
        const outputPath = path.join(platformOutputDir, `${iconName}${PLATFORM_CONFIG.macos.format}`);
        return (await fsExtra.pathExists(outputPath)) ? outputPath : null;
    }
    catch (error) {
        logger.warn(`Icon format conversion failed: ${error.message}`);
        return null;
    }
}
/**
 * Processes downloaded or local icon for platform-specific format
 */
async function processIcon(iconPath, appName) {
    if (!iconPath || !appName)
        return iconPath;
    // Check if already in correct platform format
    const ext = path.extname(iconPath).toLowerCase();
    const isCorrectFormat = (IS_WIN && ext === '.ico') ||
        (IS_LINUX && ext === '.png') ||
        (!IS_WIN && !IS_LINUX && ext === '.icns');
    if (isCorrectFormat) {
        return await copyWindowsIconIfNeeded(iconPath, appName);
    }
    // Convert to platform format
    const convertedPath = await convertIconFormat(iconPath, appName);
    if (convertedPath) {
        return await copyWindowsIconIfNeeded(convertedPath, appName);
    }
    return iconPath;
}
/**
 * Gets default icon with platform-specific fallback logic
 */
async function getDefaultIcon() {
    logger.info('✼ No icon provided, using default icon.');
    if (IS_WIN) {
        const defaultIcoPath = generateIconPath('icon', true);
        const defaultPngPath = path.join(npmDirectory, 'src-tauri/png/icon_512.png');
        // Try default ico first
        if (await fsExtra.pathExists(defaultIcoPath)) {
            return defaultIcoPath;
        }
        // Convert from png if ico doesn't exist
        if (await fsExtra.pathExists(defaultPngPath)) {
            logger.info('✼ Default ico not found, converting from png...');
            try {
                const convertedPath = await convertIconFormat(defaultPngPath, 'icon');
                if (convertedPath && (await fsExtra.pathExists(convertedPath))) {
                    return await copyWindowsIconIfNeeded(convertedPath, 'icon');
                }
            }
            catch (error) {
                logger.warn(`Failed to convert default png to ico: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        // Fallback to png or empty
        if (await fsExtra.pathExists(defaultPngPath)) {
            logger.warn('✼ Using png as fallback for Windows (may cause issues).');
            return defaultPngPath;
        }
        logger.warn('✼ No default icon found, will use pake default.');
        return '';
    }
    // Linux and macOS defaults
    const iconPath = IS_LINUX
        ? 'src-tauri/png/icon_512.png'
        : 'src-tauri/icons/icon.icns';
    return path.join(npmDirectory, iconPath);
}
/**
 * Main icon handling function with simplified logic flow
 */
async function handleIcon(options, url) {
    // Handle custom icon (local file or remote URL)
    if (options.icon) {
        if (options.icon.startsWith('http')) {
            const downloadedPath = await downloadIcon(options.icon);
            if (downloadedPath) {
                const result = await processIcon(downloadedPath, options.name || '');
                if (result)
                    return result;
            }
            return '';
        }
        // Local file path
        const resolvedPath = path.resolve(options.icon);
        const result = await processIcon(resolvedPath, options.name || '');
        return result || resolvedPath;
    }
    // Try favicon from website
    if (url && options.name) {
        const faviconPath = await tryGetFavicon(url, options.name);
        if (faviconPath)
            return faviconPath;
    }
    // Use default icon
    return await getDefaultIcon();
}
/**
 * Generates icon service URLs for a domain
 */
function generateIconServiceUrls(domain) {
    const logoDevUrls = API_KEYS.logoDev
        .sort(() => Math.random() - 0.5)
        .map((token) => `https://img.logo.dev/${domain}?token=${token}&format=png&size=256`);
    const brandfetchUrls = API_KEYS.brandfetch
        .sort(() => Math.random() - 0.5)
        .map((key) => `https://cdn.brandfetch.io/${domain}/w/400/h/400?c=${key}`);
    return [
        ...logoDevUrls,
        ...brandfetchUrls,
        `https://logo.clearbit.com/${domain}?size=256`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
        `https://favicon.is/${domain}`,
        `https://${domain}/favicon.ico`,
        `https://www.${domain}/favicon.ico`,
    ];
}
/**
 * Attempts to fetch favicon from website
 */
async function tryGetFavicon(url, appName) {
    try {
        const domain = new URL(url).hostname;
        const spinner = getSpinner(`Fetching icon from ${domain}...`);
        const serviceUrls = generateIconServiceUrls(domain);
        const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
        const downloadTimeout = isCI
            ? ICON_CONFIG.downloadTimeout.ci
            : ICON_CONFIG.downloadTimeout.default;
        for (const serviceUrl of serviceUrls) {
            try {
                const faviconPath = await downloadIcon(serviceUrl, false, downloadTimeout);
                if (!faviconPath)
                    continue;
                const convertedPath = await convertIconFormat(faviconPath, appName);
                if (convertedPath) {
                    const finalPath = await copyWindowsIconIfNeeded(convertedPath, appName);
                    spinner.succeed(chalk.green('Icon fetched and converted successfully!'));
                    return finalPath;
                }
            }
            catch (error) {
                logger.debug(`Icon service ${serviceUrl} failed: ${error.message}`);
                // Platform-specific error handling
                if ((IS_LINUX || IS_WIN) && error.code === 'ENOTFOUND') {
                    logger.debug(`DNS resolution failed for ${serviceUrl}, trying next service...`);
                }
                // Windows-specific icon conversion errors
                if (IS_WIN && error.message.includes('icongen')) {
                    logger.debug(`Windows icon conversion failed for ${serviceUrl}, trying next service...`);
                }
                continue;
            }
        }
        spinner.warn(`No favicon found for ${domain}. Using default.`);
        return null;
    }
    catch (error) {
        logger.warn(`Failed to fetch favicon: ${error.message}`);
        return null;
    }
}
/**
 * Downloads icon from URL
 */
async function downloadIcon(iconUrl, showSpinner = true, customTimeout) {
    try {
        const response = await axios.get(iconUrl, {
            responseType: 'arraybuffer',
            timeout: customTimeout || 10000,
        });
        const iconData = response.data;
        if (!iconData || iconData.byteLength < ICON_CONFIG.minFileSize)
            return null;
        const fileDetails = await fileTypeFromBuffer(iconData);
        if (!fileDetails ||
            !ICON_CONFIG.supportedFormats.includes(fileDetails.ext)) {
            return null;
        }
        return await saveIconFile(iconData, fileDetails.ext);
    }
    catch (error) {
        if (showSpinner && !(error.response?.status === 404)) {
            throw error;
        }
        return null;
    }
}
/**
 * Saves icon file to temporary location
 */
async function saveIconFile(iconData, extension) {
    const buffer = Buffer.from(iconData);
    const { path: tempPath } = await dir();
    // Always save with the original extension first
    const originalIconPath = path.join(tempPath, `icon.${extension}`);
    await fsExtra.outputFile(originalIconPath, buffer);
    return originalIconPath;
}

// Extracts the domain from a given URL.
function getDomain(inputUrl) {
    try {
        const url = new URL(inputUrl);
        // Use PSL to parse domain names.
        const parsed = psl.parse(url.hostname);
        // If domain is available, split it and return the SLD.
        if ('domain' in parsed && parsed.domain) {
            return parsed.domain.split('.')[0];
        }
        else {
            return null;
        }
    }
    catch (error) {
        return null;
    }
}
// Appends 'https://' protocol to the URL if not present.
function appendProtocol(inputUrl) {
    try {
        new URL(inputUrl);
        return inputUrl;
    }
    catch {
        return `https://${inputUrl}`;
    }
}
// Normalizes the URL by ensuring it has a protocol and is valid.
function normalizeUrl(urlToNormalize) {
    const urlWithProtocol = appendProtocol(urlToNormalize);
    try {
        new URL(urlWithProtocol);
        return urlWithProtocol;
    }
    catch (err) {
        throw new Error(`Your url "${urlWithProtocol}" is invalid: ${err.message}`);
    }
}

function resolveAppName(name, platform) {
    const domain = getDomain(name) || 'pake';
    return platform !== 'linux' ? capitalizeFirstLetter(domain) : domain;
}
function isValidName(name, platform) {
    const platformRegexMapping = {
        linux: /^[a-z0-9][a-z0-9-]*$/,
        default: /^[a-zA-Z0-9][a-zA-Z0-9- ]*$/,
    };
    const reg = platformRegexMapping[platform] || platformRegexMapping.default;
    return !!name && reg.test(name);
}
async function handleOptions(options, url) {
    const { platform } = process;
    const isActions = process.env.GITHUB_ACTIONS;
    let name = options.name;
    const pathExists = await fsExtra.pathExists(url);
    if (!options.name) {
        const defaultName = pathExists ? '' : resolveAppName(url, platform);
        const promptMessage = 'Enter your application name';
        const namePrompt = await promptText(promptMessage, defaultName);
        name = namePrompt || defaultName;
    }
    // Handle platform-specific name formatting
    if (name && platform === 'linux') {
        // Convert to lowercase and replace spaces with dashes for Linux
        name = name.toLowerCase().replace(/\s+/g, '-');
    }
    if (!isValidName(name, platform)) {
        const LINUX_NAME_ERROR = `✕ Name should only include lowercase letters, numbers, and dashes (not leading dashes). Examples: com-123-xxx, 123pan, pan123, weread, we-read, 123.`;
        const DEFAULT_NAME_ERROR = `✕ Name should only include letters, numbers, dashes, and spaces (not leading dashes and spaces). Examples: 123pan, 123Pan, Pan123, weread, WeRead, WERead, we-read, We Read, 123.`;
        const errorMsg = platform === 'linux' ? LINUX_NAME_ERROR : DEFAULT_NAME_ERROR;
        logger.error(errorMsg);
        if (isActions) {
            name = resolveAppName(url, platform);
            logger.warn(`✼ Inside github actions, use the default name: ${name}`);
        }
        else {
            process.exit(1);
        }
    }
    const appOptions = {
        ...options,
        name,
        identifier: getIdentifier(url),
    };
    const iconPath = await handleIcon(appOptions, url);
    appOptions.icon = iconPath || undefined;
    return appOptions;
}

function validateNumberInput(value) {
    const parsedValue = Number(value);
    if (isNaN(parsedValue)) {
        throw new InvalidArgumentError('Not a number.');
    }
    return parsedValue;
}
function validateUrlInput(url) {
    const isFile = fs.existsSync(url);
    if (!isFile) {
        try {
            return normalizeUrl(url);
        }
        catch (error) {
            throw new InvalidArgumentError(error.message);
        }
    }
    return url;
}

const { green, yellow } = chalk;
const logo = `${chalk.green(' ____       _')}
${green('|  _ \\ __ _| | _____')}
${green('| |_) / _` | |/ / _ \\')}
${green('|  __/ (_| |   <  __/')}  ${yellow('https://github.com/tw93/pake')}
${green('|_|   \\__,_|_|\\_\\___|  can turn any webpage into a desktop app with Rust.')}
`;
program
    .addHelpText('beforeAll', logo)
    .usage(`[url] [options]`)
    .showHelpAfterError()
    .helpOption(false);
program
    .argument('[url]', 'The web URL you want to package', validateUrlInput)
    // Refer to https://github.com/tj/commander.js#custom-option-processing, turn string array into a string connected with custom connectors.
    // If the platform is Linux, use `-` as the connector, and convert all characters to lowercase.
    // For example, Google Translate will become google-translate.
    .option('--name <string>', 'Application name')
    .option('--icon <string>', 'Application icon', DEFAULT_PAKE_OPTIONS.icon)
    .option('--width <number>', 'Window width', validateNumberInput, DEFAULT_PAKE_OPTIONS.width)
    .option('--height <number>', 'Window height', validateNumberInput, DEFAULT_PAKE_OPTIONS.height)
    .option('--use-local-file', 'Use local file packaging', DEFAULT_PAKE_OPTIONS.useLocalFile)
    .option('--fullscreen', 'Start in full screen', DEFAULT_PAKE_OPTIONS.fullscreen)
    .option('--hide-title-bar', 'For Mac, hide title bar', DEFAULT_PAKE_OPTIONS.hideTitleBar)
    .option('--multi-arch', 'For Mac, both Intel and M1', DEFAULT_PAKE_OPTIONS.multiArch)
    .option('--inject <files>', 'Inject local CSS/JS files into the page', (val, previous) => {
    if (!val)
        return DEFAULT_PAKE_OPTIONS.inject;
    // Split by comma and trim whitespace, filter out empty strings
    const files = val
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    // If previous values exist (from multiple --inject options), merge them
    return previous ? [...previous, ...files] : files;
}, DEFAULT_PAKE_OPTIONS.inject)
    .option('--debug', 'Debug build and more output', DEFAULT_PAKE_OPTIONS.debug)
    .addOption(new Option('--proxy-url <url>', 'Proxy URL for all network requests (http://, https://, socks5://)')
    .default(DEFAULT_PAKE_OPTIONS.proxyUrl)
    .hideHelp())
    .addOption(new Option('--user-agent <string>', 'Custom user agent')
    .default(DEFAULT_PAKE_OPTIONS.userAgent)
    .hideHelp())
    .addOption(new Option('--targets <string>', 'Build target format for your system').default(DEFAULT_PAKE_OPTIONS.targets))
    .addOption(new Option('--app-version <string>', 'App version, the same as package.json version')
    .default(DEFAULT_PAKE_OPTIONS.appVersion)
    .hideHelp())
    .addOption(new Option('--always-on-top', 'Always on the top level')
    .default(DEFAULT_PAKE_OPTIONS.alwaysOnTop)
    .hideHelp())
    .addOption(new Option('--dark-mode', 'Force Mac app to use dark mode')
    .default(DEFAULT_PAKE_OPTIONS.darkMode)
    .hideHelp())
    .addOption(new Option('--disabled-web-shortcuts', 'Disabled webPage shortcuts')
    .default(DEFAULT_PAKE_OPTIONS.disabledWebShortcuts)
    .hideHelp())
    .addOption(new Option('--activation-shortcut <string>', 'Shortcut key to active App')
    .default(DEFAULT_PAKE_OPTIONS.activationShortcut)
    .hideHelp())
    .addOption(new Option('--show-system-tray', 'Show system tray in app')
    .default(DEFAULT_PAKE_OPTIONS.showSystemTray)
    .hideHelp())
    .addOption(new Option('--system-tray-icon <string>', 'Custom system tray icon')
    .default(DEFAULT_PAKE_OPTIONS.systemTrayIcon)
    .hideHelp())
    .addOption(new Option('--hide-on-close', 'Hide window on close instead of exiting (default: true for macOS, false for others)')
    .default(DEFAULT_PAKE_OPTIONS.hideOnClose)
    .hideHelp())
    .addOption(new Option('--title <string>', 'Window title').hideHelp())
    .addOption(new Option('--incognito', 'Launch app in incognito/private mode')
    .default(DEFAULT_PAKE_OPTIONS.incognito)
    .hideHelp())
    .addOption(new Option('--wasm', 'Enable WebAssembly support (Flutter Web, etc.)')
    .default(DEFAULT_PAKE_OPTIONS.wasm)
    .hideHelp())
    .addOption(new Option('--enable-drag-drop', 'Enable drag and drop functionality')
    .default(DEFAULT_PAKE_OPTIONS.enableDragDrop)
    .hideHelp())
    .addOption(new Option('--keep-binary', 'Keep raw binary file alongside installer')
    .default(DEFAULT_PAKE_OPTIONS.keepBinary)
    .hideHelp())
    .addOption(new Option('--installer-language <string>', 'Installer language')
    .default(DEFAULT_PAKE_OPTIONS.installerLanguage)
    .hideHelp())
    .version(packageJson.version, '-v, --version')
    .configureHelp({
    sortSubcommands: true,
    optionTerm: (option) => {
        if (option.flags === '-v, --version')
            return '';
        return option.flags;
    },
    optionDescription: (option) => {
        if (option.flags === '-v, --version')
            return '';
        return option.description;
    },
})
    .action(async (url, options) => {
    await checkUpdateTips();
    if (!url) {
        program.help({
            error: false,
        });
        return;
    }
    log.setDefaultLevel('info');
    if (options.debug) {
        log.setLevel('debug');
    }
    const appOptions = await handleOptions(options, url);
    const builder = BuilderProvider.create(appOptions);
    await builder.prepare();
    await builder.build(url);
});
program.parse();
