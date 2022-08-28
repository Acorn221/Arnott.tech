#!/usr/bin/env sh
rm -rf dist
# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

# if you are deploying to a custom domain
echo 'www.j4a.uk' > CNAME

git init
git checkout -b main
git add -A
git commit -m 'deploy'


# if you are deploying to https://<USERNAME>.github.io/<REPO>
git push -f git@github.com:Acorn221/Acorn221.git main:gh-pages

cd -