param (
    [Parameter(Mandatory=$true)]
    [string]$TargetFile,  # Путь к файлу, который нужно изменить

    [Parameter(Mandatory=$false)]
    [string]$PubFile = "pub.xml"  # Путь к pub.xml (по умолчанию в текущей папке)
)

# Проверяем существование файлов
if (-not (Test-Path $TargetFile)) { Write-Error "Файл $TargetFile не найден!"; exit }
if (-not (Test-Path $PubFile)) { Write-Error "Файл $PubFile не найден!"; exit }

# 1. Читаем pub.xml в формате UTF-16LE
$pubBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $PubFile))
$pubUtf16 = [System.Text.Encoding]::Unicode.GetBytes([System.Text.Encoding]::UTF8.GetString($pubBytes))

# 2. Читаем целевой файл
$fileBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $TargetFile))

# 3. Переводим в ISO-8859-1 для побайтовой работы регулярки
$fileStr = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetString($fileBytes)
$pubStr  = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetString($pubUtf16)

# 4. Шаблон поиска <RSAKeyValue>...</RSAKeyValue>
$pattern = "(?s)\x3c\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00.{776}\x3c\x00\x2f\x00\x52\x00\x53\x00\x41\x00\x4b\x00\x65\x00\x79\x00\x56\x00\x61\x00\x6c\x00\x75\x00\x65\x00\x3e\x00"

# 5. Замена
$resultStr = [Regex]::Replace($fileStr, $pattern, $pubStr)

# 6. Сохранение
$resultBytes = [System.Text.Encoding]::GetEncoding("ISO-8859-1").GetBytes($resultStr)
[System.IO.File]::WriteAllBytes((Resolve-Path $TargetFile), $resultBytes)

Write-Host "Файл успешно изменен!" -ForegroundColor Green
