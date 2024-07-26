import { Context, h, Schema } from 'koishi'
import { } from 'koishi-plugin-html-renderer'

export const name = 'bangumi-calendar'

export interface Config { }

export const Config: Schema<Config> = Schema.object({})

export const inject = ['html_renderer']

interface Item {
	url: string
	title: string
	date: string
	tags: string[]
	description: string
	number: number
	rating: number
	episodes: number
	image: string
}

class BangumiCalendar {
	constructor(ctx: Context) {
		ctx.command('放送', '获取今日番剧放送时间表')
		.alias('fs')
		.option('day', '-d [day] 指定周几的番剧')
		.usage('获取今日番剧放送时间表')
		.example('放送')
		.example('放送 -d 1')
		.action(async ({ options }) => {
			if (options.day && (options.day < 1 || options.day > 7)) {
				return '周几的范围是 1-7'
			}

			const items = await BangumiCalendar.getCalendar(ctx, options.day)
			const buffer = await ctx.html_renderer.render_template_html_file(
				__dirname.replaceAll('\\', '/') + '/template',
				'template.ejs',
				{
					'items': items
				},
				{
					'viewport': { 'width': 600, 'height': 248 * items.length + 88 },
					'base_url': 'file://' + __dirname.replaceAll('\\', '/') + '/template',
				}
			)
			return h.image(buffer, 'image/png')
		})
	}

	static async getCalendar(ctx: Context, day?: number): Promise<Item[]> {
		// 获取番剧放送时间表
		const resp = await ctx.http.get('https://api.bgm.tv/calendar')

		// 获取今天周几
		const today = day ?? new Date().getDay()

		// 获取番剧详情
		let requestsQueue = []
		resp[today - 1]['items'].forEach((item: { id: number }) => {
			requestsQueue.push(ctx.http.get(`https://api.bgm.tv/v0/subjects/${item.id}`))
		});
		
		// 并发请求
		let items = []
		items = await Promise.allSettled(requestsQueue)
		// 过滤掉请求失败的数据
		items.filter((item: { status: string, value: any }) => item.status === 'fulfilled')
		items = items.map((item: { value: any }) => item.value)

		// 转换数据
		let result: Item[] = []
		items.forEach((item) => {
			if (item === undefined) return
			if (item['name'] == '' && item['name_cn'] == '') return

			result.push({
				url: '',
				title: item['name_cn'] !== '' ? item['name_cn'] : item['name'],
				date: item['date'] ?? '未知播出时间',
				tags: item['tags'] ? (item['tags'].length > 3 ? item['tags'].slice(0, 3) : item['tags']).map((tag: { name: string }) => tag['name']) : [],
				description: item['summary'] ?? '暂无简介',
				number: item['rating']['rank'] ?? '暂无排名',
				rating: item['rating']['score'] ?? '暂无评分',
				episodes: item['total_episodes'] ?? '未知集数',
				image: item['images']['large'] ? item['images']['large'] : item['images']['common'],
			})
		})

		return result
	}
}

export function apply(ctx: Context) {
	ctx.plugin(BangumiCalendar)
}
