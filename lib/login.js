const co = require('co')
const os = require('os')
const prompt = require('co-prompt')
const ProgressBar = require('progress')
const superagent = require('superagent')
const config = require('../config.json')
const utils = require('./utils')
const path = require('path');

const request = superagent.agent()
const loginConfigPath = path.join(os.homedir(), '.star.json');
/*
 *登录获得cookie
 */
function loginAndSet (username, password) {
    return new Promise((resolve, reject) => {
        request
            .post(config.login)
            .type('form')
            .send({userName: username, userPassword: password})
            .end((err, res) => {
                if (res.redirects && res.redirects.length - 0 > 0) {
                    let cookie = res.headers["set-cookie"]
                    utils.set(loginConfigPath, JSON.stringify({cookie: cookie}))
                    console.log('登陆成功')
                    resolve(cookie)
                } else {
                    console.log('登陆失败,请检查用户名密码')
                    resolve(0)
                }
            })
    })
}
function login(username, password, callback) {
    return loginAndSet(username, password)
}

module.exports = function () {
    return co(function* () {
        let username = yield prompt('Username: ');
        let password = yield prompt.password('Password: ');
        console.log('Now we are login.... with username ' + username + ' and password ' + password)
        let cookie = yield login(username, password, function () {
            console.log('Log in succeed.')
        })
        return Promise.resolve(cookie)
    })
}
