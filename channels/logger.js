function post(message) {
    const payload = JSON.stringify({ text: message })
    const nsString = $.NSString.stringWithString(payload)
    const nsData = nsString.dataUsingEncoding($.NSUTF8StringEncoding)
    const base64String = nsData.base64EncodedStringWithOptions(0).js

    const cmd = `echo "${base64String}" | base64 --decode | /usr/bin/logger -t "Musjxa"`
    app.doShellScript(cmd)
}
