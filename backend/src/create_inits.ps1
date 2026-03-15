# Create __init__.py files for all directories
$directories = @(
    "domain",
    "domain/entities", 
    "domain/repositories",
    "domain/services",
    "application",
    "application/use_cases",
    "application/interfaces",
    "infrastructure",
    "infrastructure/persistence",
    "infrastructure/persistence/repositories",
    "infrastructure/external",
    "infrastructure/external/scrapers",
    "infrastructure/external/notifications",
    "infrastructure/messaging",
    "presentation",
    "presentation/api",
    "presentation/api/v1",
    "presentation/schemas",
    "config"
)

foreach ($dir in $directories) {
    $initFile = "$dir/__init__.py"
    if (!(Test-Path $initFile)) {
        New-Item -ItemType File -Path $initFile -Force
        Write-Host "Created: $initFile"
    } else {
        Write-Host "Exists: $initFile"
    }
}
