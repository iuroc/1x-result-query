import { run } from './index.js'
import { statSync } from 'fs'

const zkzDir = process.argv[2]

try {
    if (statSync(zkzDir).isDirectory()) run(zkzDir)
} catch {
    console.error('请指定正确的准考证目录')
}