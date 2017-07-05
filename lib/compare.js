const superagent = require('superagent')
const request = superagent.agent()
const login = require('./login.js')
const config = require('../config.json')
const cheerio = require('cheerio')
const path = require('path')
const dir = path.join(`${__dirname}/../cmsCode/`)
const co = require('co')
const fs = require('fs')
let id
/*
 *根据pull,push判断版本，返回比较后的结果
 */
let returnCompareResult = (onlineTime, way = 'pull') => {
    let map, page, $, lastPullTime, lastFixTime, lastPushTime
    try {
        map = require(`${dir}.map.json`)
        page = map[id]
        lastPullTime = page.pullTime,
        lastFixTime = getFixTime(),
        lastPushTime = page.pushTime
    } catch (e) {
        return true
    }
    if (!page) {
        return true
    }
    if (!lastPullTime) {
        throw '请先pull线上代码'
    }
    if (way === 'pull') {
        if (lastPullTime === lastFixTime && onlineTime < lastFixTime) {
            return 'same'
        } else if (onlineTime < lastFixTime) {
            //线上版本落后本地版本，确认是否pull
            return false
        } else {
            //线上版本领先本地push版本，不需确认
            return true
        }
    }
    if (way === 'push') {
        if (lastPushTime === onlineTime && onlineTime >= lastFixTime) {
            return 'same'
        }
        if (onlineTime <= lastFixTime) {
            return true
        } else {
            return false
        }
    }

}
let getOnlineTime = (res) => {
    let $ = cheerio.load(res.text),
        onlineTime = $($('.j_historyButton')[0]).text().split(' | ')[1]
    return Date.parse(onlineTime) || 1
}
let getFixTime = () => {
    let map = require(`${dir}.map.json`),
        page = map[id],
        arr = ['js', 'css', 'html', 'json', 'node'],
        time = 0
    arr.map((v) => {
        try {
            let tempTime = Date.parse(fs.statSync(`${dir}/${page.name}/index.${v}`).mtime)
            if (tempTime > time) {
                time = tempTime
            }
        } catch (e) {
            time = 0
        }
    })
    return time
}
/*
 *进行比较,返回比较结果，如未登录进行登录
 */
let returnOnlineTime = (func, cookie) => {
    return co(function*() {
        return yield request
            .get(config.page + id)
            .set("Cookie", cookie)
            .then((res) => {
                if (res.redirects && res.redirects.length - 0 > 0) {
                    console.log('登陆失效，请重新登陆')
                    login().then((e) => {
                        cookie = e
                        func()
                    })
                } else {
                    return Promise.resolve(getOnlineTime(res))
                   //return Promise.resolve(returnCompareResult(res, way))
                }
            })
    })
}

let compare = (pageId, func, cookie, way) => {
    id = pageId
    return co(function*() {
        let onlineTime = yield returnOnlineTime(func, cookie)
        let result = returnCompareResult(onlineTime, way)
        return {result: result, online: onlineTime}
    })
}

module.exports = compare


