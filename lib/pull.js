const ProgressBar = require('progress');
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
    pageName = '',
    id
let mkdir = (dir) => {
    if (!fs.existsSync(dir)) { 
        fs.mkdirSync(dir)
    }
}
/*
 *html转义
 */
let unescapeHtml = (str) => {
    return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, "\"")
}
/*
 *将页面名，pullTime, pushTime映射给id
 */
let setPageMap = (name) => {
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
        map[id] = {name: name, pullTime: Date.parse(new Date()), pushTime: 0}
        utils.set(path, JSON.stringify(map))
    })
}
/*
 *pull页面依赖
 */
let pullRequire = (res) => {
    let $ = cheerio.load(res.text),
        data = {},
        pageRequire = [],
        tempRequire = []
        data.cssUrl = $('[name="cssUrl"]').val() 
        data.jsUrl = $('[name="jsUrl"]').val()
    let nameArr = $('#J_SubmitBtn')[0].attribs['data-url'].split('.html')[0].split('/')
    pageName = nameArr[nameArr.length - 1]
    $('[name="tempRequire"]').map((k, v) => {
        let value = v.attribs.value
        tempRequire.push(value)
    })
    $('[name="pageRequire"]').map((k, v) => {
        let value = v.attribs.value
        pageRequire.push(value)
    })
    data.pageRequire = pageRequire
    data.tempRequire = tempRequire
    mkdir(`${dir}/${pageName}`)
    utils.set(`${dir}/${pageName}/config.json`, JSON.stringify(data))
    setPageMap(pageName)
    return data
}
/*
 *pull页面上的代码
 */
let getCode = (res) => {
    let $ = cheerio.load(res.text),
        arr = [],
        text = res.text,
        js, css, json, html, nodejs
    if ($('#J_JsCode').length) {
        js = unescapeHtml(text.split('isbabel}">')[1].split('<\/div><div id="J_BabelCode"')[0])
        arr.push({
            type: 'js',
            content: js
        })
    } else {
        arr.push({
            type: 'js',
            content: ''
        })
    }
    if ($('#J_CssCode').length) {
        css = unescapeHtml(text.split('<div id="J_CssCode">')[1].split('</div><textarea id="J_CssCodeText" name="css">')[0])
        arr.push({
            type: 'css',
            content: css
        })
    } else {
        arr.push({
            type: 'css',
            content: ''
        })
    }
    if ($('#J_ConfigCode').length) {
        json = unescapeHtml(text.split('<div id="J_ConfigCode">')[1].split('<\/div><textarea id="J_ConfigCodeText" name="config">')[0])
        arr.push({
            type: 'json',
            content: json
        })
    } else {
        arr.push({
            type: 'json',
            content: '[]'
        })
    }
    if ($('#J_HtmlCode').length) {
        html = unescapeHtml(text.split('<div id="J_HtmlCode">')[1].split('</div><textarea id="J_HtmlCodeText" name="html">')[0])
        arr.push({
            type: 'html',
            content: html
        })
    } else {
        arr.push({
            type: 'html',
            content: ''
        })
    }
    if ($('#J_NodeJsCode').length) {
        nodejs = unescapeHtml(text.split('id="J_NodeJsCode">')[1].split('<\/div><textarea id="J_NodeJsCodeText"')[0])
        arr.push({
            type: 'node',
            content: nodejs
        })
    } else {
        arr.push({
            type: 'node',
            content: nodejs
        })
    }
    return arr
}
/*
 *将代码写入本地文件
 */
let writeCode = (arr) => {
    arr.map((v) => {
        utils.set(`${dir}/${pageName}/index.${v.type}`, v.content).catch((e) => {
            throw 'write Wrong.Wrong place:pull.js 119 line'
        })
    })
}
/*
 *比较版本，获取线上代码
 */
let pullCode = (res) => {
    return co(function*() { 
        let temp = yield compare(id, pull, cookie)
        if (temp.result === 'same') {
            console.log('代码版本相同，无需拉取')
            return
        }else if (!temp.result) {
            let ok = yield prompt.confirm('您本地的代码版本领先线上版本，拉取后，线上代码会覆盖本地代码，是否拉取? Y/N:')
            process.stdin.pause();
            if (!ok) {
                return 
            }
        }
        pullRequire(res)
        writeCode(getCode(res))
        console.log('拉取成功')
    })
}
/*
 *判断是否登录，拉取代码和依赖并写入文件
 */
let pull = () => {
    request
        .get(config.codePage + id)
        .set("Cookie", cookie)
        .end((err, res) => {
            if (res.redirects && res.redirects.length - 0 > 0) {
                console.log('登陆失效，请重新登陆')
                login().then((e) => {
                    cookie = e
                    pull()
                })
            } else {
                pullCode(res)
            }
        })
}
let setPageId = (pageId) => {
    if (pageId && pageId.length === 24) {
        console.log('Setting...');
        utils.addJson(`${__dirname}/../config.json`, {id: pageId}).then(() => {
            console.log('Setting pageid successful!')
        })
        return false
    }
    if (!config.id) {
        console.log('请先设置id')
        return false
    }
    id = config.id
    return true
}
/*
 *pull入口函数,判断是否有可用的cookie
 */
let pullFunc = (pageId) => {
    if (!setPageId(pageId)) {
        return false
    }
    console.log('Pulling...');
    mkdir(dir)
    try {
        cookie = require(path.join(os.homedir(), '.star.json')).cookie
        pull()
    } catch (e) {
        login().then((e) => {
            cookie = e
            pull()
        })
    }
}

module.exports = pullFunc
