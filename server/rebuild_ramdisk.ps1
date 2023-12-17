echo "Cleaning up and installing modules"
rm -r node_modules
npm i
echo "Cleaning up z"
rm -r build
rm -r z:\node\build
mkdir z:\node\build
rm -r z:\node\node_modules
echo "Copying files to z"
cp -r node_modules z:\node\
echo "Removing local node_modules"
rm -r node_modules
echo "Linking paths"
New-Item -Path D:\Dev\thesis\dochat-ai\server\node_modules -ItemType SymbolicLink -Value Z:\node\node_modules
New-Item -Path D:\Dev\thesis\dochat-ai\server\build -ItemType SymbolicLink -Value Z:\node\build
wsl mount -t drvfs z: /mnt/z
#wsl ln -s /mnt/z/node/node_modules/ node_modules
#wsl ln -s /mnt/z/node/build/ build
echo "Done"
