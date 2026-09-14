!!!!!!!
Проверено только на версии 1.22.6. на других версиях что-то может отличаться(но не обязательно)

также ожидается что вы умеете пользоваться посковиком, так как отвечать на ваши вопросы по поводу поиска или пользования утилит не буду
!!!!!!!

Зависимости: nodejs, openssl

создание tls ключей:
    `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=auth3.vintagestory.at' -keyout private-key.pem -out certificate.pem`

    и создаете переменную окружения `SSL_CERT_FILE=<путь до certificate.pem>`, чтобы vintagestory не ругался не неверный сертификат

запуск сервера:
    `sudo node server.js`
    либо выдайте ему права на открытие портом ниже 1024

патч игры:
    после запуска сервера будет создан файл rsa.pub.xml. в нем лежит публичный ключ, которым игра проверят сессию.
    нужно заменить оригинальный ключ на наш в файле VintagestoryLib.dll
    (на linux flatpak этот файл можно найти в /var/lib/flatpak/app/at.vintagestory.VintageStory/x86_64/stable/active/files/extra/vintagestory)

    на linux(и вероятно в любом другом *unix) можно сделать так

    сначала вывести ключ в utf16le

    `cat rsa.pub.xml | iconv -t utf16LE | od -An -tx1 -v | tr -d ' \n' | sed 's/../\\x&/g'`

    скопировать полученное и вставить в следующую команду

    `perl -0777 -pi -e 's/\x3c\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00.{776}\x3c\x00\x2f\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00/<вставляете сюда>/sg' VintagestoryLib.dll`


как я это сделал:
    выключаете все, что может передавать сетевые данные.
    потом либо используете `sudo resolvectl monitor`, либо wireshark, либо что-то подобное чтобы узнать к каким сайтам vintagestory обращается.

    я там нашел auth3.vintagestory.at

    потом пишем https сервер, который будет притворятся этим сайтом

    чтобы сделать подмену можно добавить `auth3.vintagestory.at 127.0.0.1` в hosts

    на сервере логируем все запросы(в том числе содержимое POST), чтобы понять что клиент отправляет

    чтобы понять, что отправлять в ответ, открываем что-то типа ILSpy и пытаемcя найти логику логина
    на моей версии я смог найти то, что нужно в VintagestoryLib.dll -> Vintagestory.Client -> GuiScreenLogin -> OnLogin
    там используется SessionManager.DoLogin. ILSpy позволяет переходить по функциям.
    там будут такие строки
    ```
    List<KeyValuePair<string, string>> obj = new List<KeyValuePair<string, string>>();
	obj.Add(new KeyValuePair<string, string>("email", CS$<>8__locals0.email));
	obj.Add(new KeyValuePair<string, string>("password", password));
	obj.Add(new KeyValuePair<string, string>("totpcode", totpCode));
	obj.Add(new KeyValuePair<string, string>("prelogintoken", prelogintoken));
	obj.Add(new KeyValuePair<string, string>("gameloginversion", "1.22.6"));
	FormUrlEncodedContent postData = new FormUrlEncodedContent((System.Collections.Generic.IEnumerable<KeyValuePair<string, string>>)obj);
	Uri uri = new Uri("https://auth3.vintagestory.at/v2/gamelogin");
    ```
    что в целом я и так уже выяснил
    а также
    ```
    LoginResponse loginResponse = JsonConvert.DeserializeObject<LoginResponse>(args.Response);
    ScreenManager.Platform.Logger.Debug("Server login response: {0}, reason: {1}", new object[2]
    {
        (loginResponse.valid == 1) ? "valid" : "invalid",
        loginResponse.reason
    });
    ClientSettings.MpToken = null;
    if (loginResponse.valid == 1)
    {
        ClientSettings.UserEmail = CS$<>8__locals0.email;
        ClientSettings.Sessionkey = loginResponse.sessionkey;
        ClientSettings.SessionSignature = loginResponse.sessionsignature;
        ClientSettings.HasGameServer = loginResponse.hasgameserver;
        ClientSettings.PlayerUID = loginResponse.uid;
        ClientSettings.PlayerName = loginResponse.playername;
        ClientSettings.Entitlements = loginResponse.entitlements;
        if (CS$<>8__locals0.<>4__this.IsCachedSessionKeyValid())
        {
            CS$<>8__locals0.OnLoginComplete.Invoke(EnumAuthServerResponse.Good, loginResponse.reason, string.Empty, string.Empty);
        }
        else
        {
            CS$<>8__locals0.OnLoginComplete.Invoke(EnumAuthServerResponse.Bad, "invalidcachedsessionkey", string.Empty, string.Empty);
        }
    }
    ```
    то есть, клиент ожидает json, где будут поля valid, sessionKey, sessionsignature, hasgameserver, uid, playername и entitlements

    также код функции проверки ответа
    ```
    public bool IsCachedSessionKeyValid()
    {
    	//IL_0002: Unknown result type (might be due to invalid IL or missing references)
    	//IL_0008: Expected O, but got Unknown
    	//IL_0042: Unknown result type (might be due to invalid IL or missing references)
    	bool flag = false;
    	try
    	{
    		RSACryptoServiceProvider val = new RSACryptoServiceProvider();
    		((AsymmetricAlgorithm)val).FromXmlString("<RSAKeyValue><Modulus>uX3zQ7w6UDZHV6fTZHP1PT6PvQbqs8vu975k9m1A0eKHJj2wJDhoRMKVcQ3eE5qJw91PgaH0iUcEHUYTLYxqUqnn/NlfiRvuV8rlKZlTSkM0ShErCLxUy2ACE0c859OIAMRguKoPmLzqEKTFnO538JPasbbL2PGcHmlFXyfTiMQDYlocJaIA+qtJ+9/cTIi5zU9hyv3CNmw8rk90nJyalBNWPYu1yJ9xAJiYvVAJezyrYCzuvHjLpnvETZPMvW15qgD442la9Jc5xxaKRlrN+uhkTX/HJYW3poARWFURCmn1c++LO5m7dyF9vdgRz/wI+5wEYE8E+qNDvwlLYz+cbw==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>");
    		if (ClientSettings.Sessionkey == null)
    		{
    			return false;
    		}
    		byte[] array = SHA256.HashData(Encoding.get_UTF8().GetBytes(ClientSettings.Sessionkey));
    		byte[] array2 = Convert.FromBase64String(ClientSettings.SessionSignature);
    		flag = ((RSA)val).VerifyHash(array, array2, HashAlgorithmName.get_SHA256(), RSASignaturePadding.get_Pkcs1());
    		flag &= !string.IsNullOrEmpty(ClientSettings.PlayerUID);
    		((AsymmetricAlgorithm)val).Dispose();
    		return flag;
    	}
    	catch (System.Exception)
    	{
    		return flag;
    	}
    }
    ```

    собственно вот строка с rsa, которую надо заменить при краке
