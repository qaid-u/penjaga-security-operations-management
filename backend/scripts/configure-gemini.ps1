$ErrorActionPreference = 'Stop'
$settingsPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.env'))
if (-not (Test-Path -LiteralPath $settingsPath)) { throw 'Create backend/.env using backend/.env.example first.' }
$secret = Read-Host 'Paste your Gemini API key (input is hidden)' -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
try {
    $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    if ($value.Length -lt 20 -or $value -match '[\r\n\s"'']') { throw 'The key is empty or contains invalid whitespace/quotes.' }
    $settings = [IO.File]::ReadAllText($settingsPath)
    $updates = @{ GEMINI_API_KEY = $value; NLP_AI_REVIEW_ENABLED = 'true'; GEMINI_REVIEW_MODEL = 'gemini-3.5-flash-lite' }
    foreach ($name in $updates.Keys) {
        $pattern = '(?m)^\s*' + [regex]::Escape($name) + '\s*=.*$'
        $replacement = $name + '=' + $updates[$name]
        if ([regex]::IsMatch($settings, $pattern)) { $settings = [regex]::Replace($settings, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement }) }
        else { $settings = $settings.TrimEnd() + "`n" + $replacement + "`n" }
    }
    [IO.File]::WriteAllText($settingsPath, $settings.Replace("`r`n", "`n"), [Text.UTF8Encoding]::new($false))
    Write-Host 'Gemini settings saved privately. Restart the backend, then run node backend/scripts/check-gemini-review.js from the project root.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $value = $null
    $updates = $null
    $settings = $null
}
