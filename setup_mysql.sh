#!/bin/bash

echo "🔧 Configurando MySQL para el proyecto..."

# Verificar si Homebrew está instalado
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew no está instalado. Por favor, instala Homebrew primero:"
    echo '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
    exit 1
fi

# Instalar MySQL
echo "📦 Instalando MySQL..."
brew install mysql

# Iniciar MySQL
echo "🚀 Iniciando MySQL..."
brew services start mysql

# Esperar a que MySQL inicie
sleep 5

# Configurar seguridad (crear usuario y base de datos)
echo "🔐 Configurando base de datos..."

# Crear base de datos
mysql -u root -e "CREATE DATABASE IF NOT EXISTS concursos_db;"

# Crear usuario con contraseña
mysql -u root -e "CREATE USER IF NOT EXISTS 'root'@'localhost' IDENTIFIED BY 'tu_password';"
mysql -u root -e "GRANT ALL PRIVILEGES ON concursos_db.* TO 'root'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"

# Verificar conexión
echo "🔍 Verificando conexión..."
mysql -u root -ptu_password -e "USE concursos_db; SHOW TABLES;"

echo "✅ MySQL configurado exitosamente!"
echo "📊 Base de datos: concursos_db"
echo "👤 Usuario: root"
echo "🔑 Contraseña: tu_password"
echo ""
echo "🎯 Ahora puedes iniciar el backend con:"
echo "cd /Users/matiassack/Documents/Matias/Escuela/backend && python main.py"
