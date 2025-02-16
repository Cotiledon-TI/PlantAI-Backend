const { execSync } = require('child_process');
const usuarioDocker = "nicolasf1"
const nombreApp = "cotiledonapp"
// Dar formato a los comandos
const args = process.argv.slice(2); // Remover "node" y path del script
const tagArg = args.find((arg) => arg.startsWith('--tag'));

if (!tagArg) {
  console.error(
    'Error: No se especificó un tag. Uso: yarn image:build --tag=<tag>',
  );
  process.exit(1);
}

// Extraer el tag
const tag = tagArg.includes('=') ? tagArg.split('=')[1] : tagArg.split(' ')[1];

// Crear la imagen
const imageName = `${usuarioDocker}/${nombreApp}:${tag}`;
const command = `docker build -t ${imageName} .`;

try {
  console.log(`Creando la imagen Docker: ${imageName}`);
  // console.log(command)
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  console.error('Error creando la imagen:', error.message);
  process.exit(1);
}
