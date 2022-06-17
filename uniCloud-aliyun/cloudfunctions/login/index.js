'use strict';
const db = uniCloud.database()

exports.main = async (event, context) => {
	//event为客户端上传的参数
	// console.log('event : ', event)
	let code = event.code;

	let Appid = await db.collection('wx_config').where({
		"key": "Appid"
	}).get()
	let secret = await db.collection('wx_config').where({
		"key": "secret"
	}).get()

	const APPID = Appid.data[0].val
	const APPSECRET = secret.data[0].val
	let Wx_userinfo = {}
	
	try {
		let url =
			`https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${APPSECRET}&js_code=${code}&grant_type=authorization_code`

		const res = await uniCloud.httpclient.request(url, {
			method: "GET",
			contentType: 'json',
			dataType: "json"
		})
		let data = res.data
		if (!data.openid) {
			return '微信登录失败！'
		}
		
		Wx_userinfo = res.data

	} catch (e) {
		//TODO handle the exception
		return '异常错误'
	}
	
	
	let user = await db.collection('users').where({"openid": Wx_userinfo.openid}).get()
	if (user.data.length == 0) {
		let Token_res = await getToken({APPID,APPSECRET})
		let res = await db.collection("users").add({...Wx_userinfo,...{'access_token':Token_res.data.access_token,"expires_in":Token_res.data.expires_in}})
	} else {
		if (user.data[0].expires_in > new Date().getTime()) {
			Wx_userinfo = {...Wx_userinfo,...user.data[0]}
		} else {
			let Token_res = await getToken({APPID,APPSECRET})
			let res = await db.collection('users').where({"openid":Wx_userinfo.openid}).update({'access_token':Token_res.data.access_token,"expires_in":Token_res.data.expires_in})
			if(res.updated > 0){
				console.log('token更新成功')
			}
		}
	}
	user = await db.collection('users').where({"openid": Wx_userinfo.openid}).get()
	Wx_userinfo = {...Wx_userinfo,...user.data[0]}

	//返回数据给客户端
	return Wx_userinfo
};

var getToken = async (params)=>{
	let {APPID,APPSECRET} = params;
	let url =
		`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
	let res = await uniCloud.httpclient.request(url, {
		method: "GET",
		contentType: "json",
		dataType: 'json'
	})
	if (!res.data.access_token) {
		return 'Token获取失败！'
	}
	res.data.expires_in = res.data.expires_in * 1000 + new Date().getTime() - 5 * 60 * 1000
	
	return res
}