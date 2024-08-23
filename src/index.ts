import { readdirSync } from 'fs'
import PQueue from 'p-queue'
import { join } from 'path'
import { getDocument } from 'pdfjs-dist'
import chalk from 'chalk'

/** 查询 1+X 考试成绩
 * @param zkzDir 存放准考证 PDF 文件的文件夹
 */
export const run = async (zkzDir: string) => {
    const files = readdirSync(zkzDir)
    const allResult: TaskResult[] = []
    const queue = new PQueue({ concurrency: 5 })
    queue.on('completed', (allResults: TaskResult) => allResult.push(allResults))
    queue.on('idle', () => {
        console.log('\x1b[2K\n🚩 考试成绩排名\n')
        allResult.flat().sort((a, b) => parseFloat(b.result.realPassMark) - parseFloat(a.result.realPassMark)).forEach(({ result, name }, index) => {
            console.log(chalk.grey(`[${index + 1}]` + '\t' + chalk[result.certResult.label == '已通过' ? 'green' : 'red'](
                `${name}\t${result.certResult.label}\t${result.realPassMark}`
            )))
        })
        console.log('')
    })
    files.forEach(fileName => {
        addTask(queue, zkzDir, fileName)
    })
}

/** 从准考证中获取基本信息 */
const loadInfo = async (pdfPath: string) => {
    const doc = await getDocument(pdfPath).promise
    const page = await doc.getPage(1)
    const text = await page.getTextContent()
    const info = new Map<'name' | 'sfz' | 'zkz', string>()
    text.items.forEach((item: any) => {
        const str = item.str as string
        const matchName = str.match(/^学生姓名：\s+(.+)/)
        if (matchName) info.set('name', matchName[1])
        const matchSfz = str.match(/^身份证号：\s+(.+)/)
        if (matchSfz) info.set('sfz', matchSfz[1])
        const matchZkz = str.match(/^准考证号：\s+(.+)/)
        if (matchZkz) info.set('zkz', matchZkz[1])
    })
    if (info.size != 3) throw new Error('获取信息失败或不完整')
    return {
        name: info.get('name') as string,
        sfz: info.get('sfz') as string,
        zkz: info.get('zkz') as string,
    }
}

/** 获取某个准考证的成绩 */
const addTask = async (queue: PQueue, dirPath: string, fileName: string) => {
    return queue.add<TaskResult>(async () => {
        const filePath = join(dirPath, fileName)
        const info = await loadInfo(filePath)
        process.stdout.write(`\r\x1b[2K正在获取 [${chalk.bold(chalk.blueBright(info.name))}] 的成绩结果...`)
        const results = await getResults(info.sfz, info.zkz)
        return results.map(item => ({
            name: info.name,
            result: item
        }))
    }).catch(() => {
        addTask(queue, dirPath, fileName)
    })
}

/** 获取远程响应 */
const getResults = async (sfz: string, zkz: string): Promise<Result[]> => {
    return fetch('https://www.ncb.edu.cn/portal/exam/getNoAccPersonPage', {
        method: 'post', body: JSON.stringify({
            examNumber: zkz,
            idCardNo: sfz,
            idCardType: '1',
            limit: 10,
            page: 1,
            studName: null
        }),
        headers: {
            'Content-Type': 'application/json',
        }
    }).then(res => res.json()).then(data => {
        if (!data.data) {
            throw new Error('错误')
        }
        return data.data.page.records as Result[]
    })
}

type TaskResult = { name: string, result: Result }[]

type Result = {
    /** 证书获得结果 */
    certResult: {
        /** eg. 通过 / 未通过 */
        label: string
    },
    /** 考试名称
     * 
     * eg. 2024年6月Web前端开发职业技能等级证书考试
     */
    planName: string,
    /** 证书名称
     * 
     * eg. Web前端开发职业技能等级证书
     */
    certificateName: string
    /** 分数
     * 
     * eg. "39.00"
     */
    realPassMark: string
    /** 证书等级 */
    certificateGrade: {
        /** eg. 中级 */
        msg: string
    }
}