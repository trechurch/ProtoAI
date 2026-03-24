@echo off
for %%D in (
    "D:\ui\Lib\monaco\vs"
    "D:\ui\Lib\monaco\vs\editor"
    "D:\ui\Lib\monaco\vs\base\worker"
    "D:\ui\Lib\monaco\vs\language\json"
    "D:\ui\Lib\monaco\vs\language\javascript"
    "D:\ui\Lib\monaco\vs\language\markdown"
    "D:\ui\Lib\monaco\vs\basic-languages\javascript"
    "D:\ui\Lib\monaco\vs\basic-languages\json"
    "D:\ui\Lib\monaco\vs\basic-languages\markdown"
) do (
    md "%%~D" 2>nul
)
echo Done.
