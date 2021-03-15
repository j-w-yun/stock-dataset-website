function request(config) {
	const url = config['url'];
	const type = config['type'];
	let data = config['data'];
	return new Promise(function (resolve, reject) {
		if (data == null)
			data = {};
		const req = new XMLHttpRequest();
		req.open(type, url, true);
		req.overrideMimeType('application/json');
		req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
		req.onload = function () {
			if (req.readyState === 4 && req.status === 200) {
				try {
					return resolve(JSON.parse(req.responseText));
				}
				catch(e) {
					return resolve(req.responseText);
				}
			}
			return resolve(null);
		};

		const data_array = [];
		for (const i in data)
			data_array.push(i+'='+data[i]);
		req.send(data_array.join('&'));
	});
}

function get_tables() {
	const req = request({
		'url': '/project/social_stock/tables',
		'type': 'POST',
	});
	return new Promise(function (resolve, reject) {
		req.then(function (res) {
			if (res == null || res == 'error')
				resolve(null);
			res = res.map(x => x['Tables_in_stocks']);
			resolve(res);
		});
	});
}

function get_count(table) {
	const req = request({
		'url': '/project/social_stock/count',
		'type': 'POST',
		'data': {'table': table},
	});
	return new Promise(function (resolve, reject) {
		req.then(function (res) {
			if (res == null || res == 'error')
				resolve(null);
			res = res[0]['COUNT(*)'];
			resolve(res);
		});
	});
}

function get_size() {
	const req = request({
		'url': '/project/social_stock/size',
		'type': 'POST',
	});
	return new Promise(function (resolve, reject) {
		req.then(function (res) {
			if (res == null || res == 'error')
				resolve(null);
			res = {
				'size': res[0]['SUM(DATA_LENGTH+INDEX_LENGTH)'],
				'rows': res[0]['SUM(TABLE_ROWS)'],
			};
			resolve(res);
		});
	});
}

function get_estimate() {
	const req = request({
		'url': '/project/social_stock/estimate',
		'type': 'post',
	});
	return new Promise(function (resolve, reject) {
		req.then(function (res) {
			if (res == null || res == 'error')
				resolve(null);
			resolve(res);
		});
	});
}

function execute(cmd) {
	const req = request({
		'url': '/project/social_stock/execute',
		'type': 'post',
		'data': {'cmd': cmd},
	});
	return new Promise(function (resolve, reject) {
		req.then(function (res) {
			if (res == null || res == 'error')
				resolve(null);
			resolve(res);
		});
	});
}

// get_tables();
// get_count('Reddit_GME');
// get_size();
// get_estimate();
// execute('SELECT COUNT(*) FROM Reddit_GME');

function parse_datetime(dt, is_date=false) {
	if (dt instanceof Date)
		dt = dt.getFullYear()+'-'+(dt.getMonth()+1)+'-'+dt.getDate()+' '+dt.getHours()+':'+dt.getMinutes()+':'+dt.getSeconds();
	const t = dt.split(/[- :T.]/);
	if (is_date)
		return new Date(Date.UTC(t[0], t[1]-1, t[2]));
	return new Date(Date.UTC(t[0], t[1]-1, t[2], t[3], t[4], t[5]));
}

function is_number(o) {
	return typeof o === 'number' && o === o && o !== Infinity && o !== -Infinity;
}

function calc_stats(data) {
	const keys = Object.keys(data[0]);
	const is_comparable = {};
	const is_date = {};
	const max = {};
	const min = {};
	for (const i in data) {
		for (const k of keys) {
			if (k == 'reddit_url' || k == 'twitter_url')
				continue;
			const val = data[i][k];
			if (val == null)
				continue;
			if (val === '') {
				is_comparable[k] = false;
				continue;
			}
			let is_null_date = false;
			let num = Number(val);
			if (isNaN(num)) {
				num = Date.parse(val);
				is_date[k] = true;
				if (!isNaN(num) && num/1000 < 0) {
					is_null_date = true;
					num = null;
					data[i][k] = null;
				}
			}
			if (!is_comparable.hasOwnProperty(k)) {
				is_comparable[k] = is_null_date || num instanceof Date || is_number(num);
			}
			else if (is_comparable[k]) {
				is_comparable[k] = is_null_date || num instanceof Date || is_number(num);
				if ((max[k] == null || min[k] == null) && num != null) {
					max[k] = num;
					min[k] = num;
				}
				if (num != null && max[k] < num)
					max[k] = num;
				if (num != null && min[k] > num)
					min[k] = num;
			}
		}
	}
	return {
		'comparable': is_comparable,
		'date': is_date,
		'max': max,
		'min': min,
	};
}

function calc_words(data, info, cols) {
	const ignore_words = [
		'shares',
		'stocks',
		'https',
		'red',
		'dit',
	];

	const all_words = {};
	let agg_words = {};
	const agg_type_words = {};
	const agg_type_count = {};
	for (const d of data) {
		const date = parse_datetime(d['datetime'], true);
		if (!agg_words.hasOwnProperty(date))
			agg_words[date] = {};
		if (!agg_type_words.hasOwnProperty(date))
			agg_type_words[date] = {};
		if (!agg_type_count.hasOwnProperty(date))
			agg_type_count[date] = {};

		for (const k of cols) {
			if (!agg_type_words[date].hasOwnProperty(k))
				agg_type_words[date][k] = {};
			if (!agg_type_count[date].hasOwnProperty(k))
				agg_type_count[date][k] = 0;

			const split_words = d[k].split(',');
			// console.log(words);
			for (const raw_word of split_words) {
				const word = raw_word.toLowerCase();
				if (word.length <= 2)
					continue;
				if (word.length < 5 && k.includes('ner'))
					continue;
				if (ignore_words.includes(word))
					continue;
				if (info['symbol'].toLowerCase().includes(word))
					continue;
				if (info['short_name'].toLowerCase().includes(word))
					continue;

				if (!all_words.hasOwnProperty(word))
					all_words[word] = 0;
				all_words[word]++;
				if (!agg_words[date].hasOwnProperty(word))
					agg_words[date][word] = 0;
				agg_words[date][word]++;
				if (!agg_type_words[date][k].hasOwnProperty(word))
					agg_type_words[date][k][word] = 0;
				agg_type_words[date][k][word]++;
				agg_type_count[date][k]++;
			}
		}
	}
	// console.log(all_words);
	// console.log(agg_words);
	// console.log(agg_type_words);
	// console.log(agg_type_count);

	const max_top = 50;
	const sorted_words = {};
	for (const d in agg_words) {
		sorted_words[d] = {};
		const date_words = agg_words[d];
		// console.log(date_words);
		const items = Object.keys(date_words).map(function (k) {
			return [k, date_words[k]];
		});
		items.sort(function (a, b) {
			return b[1] - a[1];
		});
		const n_top = Math.min(max_top, items.length);
		const slice = items.slice(0, n_top);
		for (const elem of slice) {
			const w = elem[0];
			const n = elem[1];
			sorted_words[d][w] = n;
		}
	}
	agg_words = sorted_words;

	const words = [];
	for (const k of Object.keys(all_words)) {
		const n = all_words[k];
		if (n > 2)
			words.push({
				'text': k,
				'size': n,
			});
	}

	const res = {};
	res.all_words = all_words;
	res.agg_words = agg_words;
	res.agg_type_words = agg_type_words;
	res.agg_type_count = agg_type_count;

	return res;
}

class Dataset {
	constructor() {
		const self = this;
		self.n_rows = 100;
		self.default_orders = [['datetime', 'DESC'],];
		self.reset();
	}

	reset() {
		const self = this;
		self.tables = [];
		self.table = 'Reddit_GME';
		self.data = [];
		self.page = 1;
		self.orders = [];
		self.is_custom_cmd = false;
	}

	get_cmd() {
		const self = this;
		let orders_arr = self.orders;
		if (self.orders.length == 0)
			orders_arr = self.default_orders;
		const flat_orders = [];
		for (const pair of orders_arr)
			flat_orders.push(pair.join(' '));
		const order_cmd = flat_orders.join(', ');
		let cmd = 'SELECT * FROM '+self.table;
		if (self.table.includes('Finance') || self.table.includes('Reddit') || self.table.includes('Twitter') || self.orders.length > 0)
			cmd += '\n\tORDER BY '+order_cmd;
		cmd += '\n\tLIMIT '+self.n_rows;
		cmd += '\n\tOFFSET '+(self.page*self.n_rows-self.n_rows)+';';
		return cmd;
	}

	update(cmd=null) {
		const self = this;
		self.cmd = cmd;
		if (self.cmd == null) {
			self.cmd = self.get_cmd();
			self.is_custom_cmd = false;
		}
		else {
			const tables = self.tables;
			self.reset();
			self.is_custom_cmd = true;
			const split_cmd = cmd.toLowerCase().split(/\s+/);

			let i = -1;
			const indexes = [];
			while ((i = split_cmd.indexOf('from', i+1)) != -1){
				indexes.push(i);
			}
			for (const index of indexes) {
				const table = cmd.split(/\s+/)[index+1];
				if (tables.includes(table)) {
					self.table = table;
					break;
				}
			}
		}
		self.cmd = self.cmd.trim();

		// window.dispatchEvent(start_update_event);
		postMessage({
			'name': 'start_update',
			'res': dataset,
		});

		const promises = [
			get_tables(),
			get_size(),
			get_count(self.table),
			execute(encodeURIComponent(self.cmd)),
		];
		Promise.all(promises)
			.then(function (results) {
				self.result = results[3];
				if (results[3].status == 'success') {
					self.tables = results[0];
					self.count_all = results[1]['rows'];
					self.size = results[1]['size'];
					self.count = results[2];
					self.data = results[3].value;
				}
				// console.log('worker: cmd', self.cmd);
				// console.log('worker: table', self.table);
				// console.log('worker: tables', self.tables);
				// console.log('worker: count_all', self.count_all);
				// console.log('worker: count', self.count);
				// console.log('worker: data', self.data);

				// window.dispatchEvent(update_event);
				postMessage({
					'name': 'update',
					'res': dataset,
				});
			});
	}
}

const dataset = new Dataset();

onmessage = function (e) {
	const name = e.data.name;
	const fn = e.data.fn;
	const args = e.data.args;
	console.log('recv fn: '+fn+' name: '+name);

	if (fn == 'request_update') {
		if (args != null) {
			dataset.page = args['page'];
			dataset.table = args['table'];
			dataset.update(args['cmd']);
		}
		else {
			dataset.update();
		}
	}
	if (fn == 'stats') {
		if (args == null || args.length == 0)
			return;
		const res = calc_stats(args);
		return postMessage({
			'name': name,
			'fn': fn,
			'res': res,
		});
	}
	if (fn == 'words') {
		if (args == null || args.length == 0)
			return;
		const res = calc_words(...args);
		return postMessage({
			'name': name,
			'fn': fn,
			'res': res,
		});
	}
};
