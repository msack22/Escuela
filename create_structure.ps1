# Script para crear estructura de carpetas
$folders = @(
    "backend/src/config",
    "backend/src/domain/entities",
    "backend/src/domain/repositories", 
    "backend/src/domain/services",
    "backend/src/application/use_cases",
    "backend/src/application/interfaces",
    "backend/src/infrastructure/persistence/repositories",
    "backend/src/infrastructure/external/scrapers",
    "backend/src/infrastructure/external/notifications",
    "backend/src/infrastructure/messaging",
    "backend/src/presentation/api/v1",
    "backend/src/presentation/schemas",
    "frontend/src/components/common",
    "frontend/src/components/features/contests",
    "frontend/src/components/features/schools",
    "frontend/src/components/features/alerts",
    "frontend/src/hooks",
    "frontend/src/services/api",
    "frontend/src/services/storage",
    "frontend/src/store/slices",
    "frontend/src/types",
    "frontend/src/utils",
    "frontend/src/styles/components"
)

foreach ($folder in $folders) {
    if (!(Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force
        Write-Host "Created: $folder"
    } else {
        Write-Host "Exists: $folder"
    }
}
