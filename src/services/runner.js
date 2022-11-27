


function runCommand(command, args, callback = undefined) {
    killProcess().then(() => { commandRunner(command, args, callback); });
}


function commandRunner(command, args, callback) {
    statusbarRef.value.notifyLoadStart();
    consoleRef.value.print(`> ${command}`, INFO_LEVEL.user);

    runningProcess = window.api.spawnProcess(command, args, file.path);

    runningProcess.registerHandler('error', (err) => {
        consoleRef.value.print(err, INFO_LEVEL.err);
    });

    runningProcess.registerHandler('stdout', (data) => {
        consoleRef.value.print(data.toString());
    });

    runningProcess.registerHandler('stderr', (data) => {
        if (file.lang !== undefined && langInfo[file.lang].linere != null) {
            const line = langInfo[file.lang].linere.replaceAll('<name>', file.name);
            const re = new RegExp(line, 'gi');
            data = data.replaceAll(re, '<a class="jump-to-line" href="#$2">$1</a>');
        }
        consoleRef.value.print(data, INFO_LEVEL.error);
    });
    processIndicatorUi.classList.add('active');

    runningProcess.registerHandler('close', (code) => {
        // Here you can get the exit code of the script
        switch (code) {
            case 0:
                notify('confirm');
                break;
            default:
                notify('error');
                break;
        }

        processIndicatorUi.classList.remove('active');
        statusbarRef.value.notifyLoadEnd();
        runningProcess = null;

        if (callback !== undefined) {
            callback(code);
        }
    });
}
