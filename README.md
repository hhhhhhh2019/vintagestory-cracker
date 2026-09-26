добавляете в `hosts`(см. гугл) что-то такое
```
127.0.0.1 auth3.vintagestory.at
```

после генерируете сертификат для сервера
```console
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -subj '/CN=auth3.vintagestory.at' -keyout private-key.pem -out certificate.pem
```

добавляете его в доверенные в системе(см. гугл) или (если на linux flatpak) можно добавить переменную окружения для vintagestory
```console
flatpak override --user --SSL_CERT_FILE=/путь/до/certificate.pem --filesystem=/путь/до/папки/где/лежит/certificate.pem at.vintagestory.VintageStory
```

запускаете сервер первый раз

```console
sudo node server/server.js
```

он создаст rsa ключи. теперь надо пропатчить vintagestory чтобы он принял наши ключи

на Linux
```console
perl -0777 -pi -e "s/\x3c\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00.{776}\x3c\x00\x2f\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00/$(cat pub.xml | iconv -t utf16LE | od -An -tx1 -v | tr -d ' \n' | sed 's/../\\x&/g')/sg" /путь/до/VintageStoryLib.dll
```

для Windows есть скрипт. НО, я не разбираюсь в powershell. Этот скрипт сгенерировал google.com/ai. понятия не имею работает ли он
```console
.\patch.ps1 -TargetFile "C:\путь\до\VintageStoryLib.dll"
```

после запускаете сервер еще раз и запускаете VintageStory. пароль не важен, email - имя игрока


API для скачиания клинетов на все доступные платформы
https://api.vintagestory.at/stable.json
