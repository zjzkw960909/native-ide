const ProgressBar = require('progress')
const chokidar = require('chokidar');
const utils = require('./utils')
const os = require('os')
const co = require('co')
const fs = require('fs')
const prompt = require('co-prompt')
const superagent = require('superagent')
const request = superagent.agent()
const cheerio = require('cheerio')
const path = require('path');
const dir = path.join(`${__dirname}/../cmsCode/`)
const config = require('../config.json')
const login = require('./login.js')
const compare = require('./compare.js')
let cookie = '',
    id
/*
 *读取本地代码
 */
let getLocalCode = () => {
    let map = require(`${dir}.map.json`)
    let page = map[id]
    let readPath = `${dir}/${page.name}`

    return co(function*() {
        let config = yield utils.get(`${readPath}/config.json`),
            js = yield utils.get(`${readPath}/index.js`),
            css = yield utils.get(`${readPath}/index.css`),
            html = yield utils.get(`${readPath}/index.html`),
            field = yield utils.get(`${readPath}/index.json`),
            node = yield utils.get(`${readPath}/index.node`),
            data = {
                js: js || '',
                css: css || '',
                html: html || '',
                nodejs: node || 'var query = KISSY.mix(req.body,req.query)',
                config: field || '[]'
            }
        let postData = Object.assign(JSON.parse(config), data)
        return postData
    })
}
/*
 *版本比较
 */
let pushCode = () => {
    return co(function*() { 
        let temp = yield compare(id, push, cookie, 'push')
        if (temp.result === 'same') {
            console.log('您已push...')
            return false
        }
        if (!temp.result) {
            console.log('您本地的代码落后于线上代码，请先pull...')
            return false
        }
        let localCode = yield getLocalCode()
        return localCode
    })
}
/*
 *设置push时间
 */
let setPushTime = (pushTime) => {
    let path = `${dir}.map.json`
    co(function*() {
        let map
        try {
            map = yield utils.get(path)
        } catch (e) {
            yield utils.set(path, '{}')
            map = yield utils.get(path)
        }
        map = JSON.parse(map)
        map[id].pushTime = pushTime
        utils.set(path, JSON.stringify(map))
    })
}
/*
 *同步
 */
let httpPost = (postData) => {
    request
        .post(config.codePage + id)
        .set('Accept', 'text/html; charset=utf-8')
        .set("Cookie", cookie)
        .send(postData)
        .end((err, res) => {
            if (err) {
                console.log('saveCodeErr: ' + JSON.stringify(res))
                return 
            }
            if (res.redirects && res.redirects.length - 0 > 0) {
                console.log('登陆失效，请重新登陆')
                login().then((e) => {
                    cookie = e
                    push()
                })
            } else {
                httpRender()
                pushLastTime()
            }
        })
}
/*
 *获取pushLastTime,设置，并render
 */
let pushLastTime = () => {
    co(function*() {
        let data = yield compare(id, push, cookie, 'push')
        setPushTime(data.online)
        return true
    })
}
/*
 *httpRender
 */
let httpRender = () => {
    request
        .get(config.refreshPage + id)
        .set("Cookie", cookie)
        .end((err, res) => {
            if (err) {
                console.log('RenderErr: ' + JSON.stringify(res))
            } else {
                console.log('渲染成功')
            }
        })
}

let getPageId = () => {
    if (!config.id) {
        console.log('请先设置id')
        return false
    }
    id = config.id
    return true
}

let push = () => {
    co(function*() {
        let postData = yield pushCode()
        if (!postData) {
            return 
        }
        httpPost(postData)
    })
}
//function push(callback) {
  //var bar = new ProgressBar(':bar', {
    //total: 10
  //})
  //var timer = setInterval(function () {
    //bar.tick();
    //if (bar.complete) {
      //clearInterval(timer)
      //callback();
    //}
  //}, 500);
//}
/*
 *func入口函数
 */
let watch = () => {
    let map = require(`${dir}.map.json`)
    let page = map[id]
    let readPath = `${dir}/${page.name}`
    chokidar.watch(readPath, {ignored: /(^|[\/\\])\../}).on('all', (event, fileName) => {
        if (event === 'change') {
            console.log('正在push!')
            push() 
        }
    })
}
let pushFunc = (temp) => {
    console.log('Pushing...');
    if (!getPageId()) {
        return false
    }
    try {
        cookie = require(path.join(os.homedir(), '.star.json')).cookie
        if (temp === 'watch') {
            return watch()
        }
        push()
    } catch (e) {
        login().then((e) => {
            cookie = e
            if (temp === 'watch') {
                return watch()
            }
            push(temp)
        })
    }
}

module.exports = pushFunc
