#!/bin/bash

set -Eeuo pipefail

GREEN=$(tput setaf 2)
RED=$(tput setaf 1)
RED_BG=$(tput setab 1)
YELLOW=$(tput setaf 3)
RESET=$(tput sgr 0)
BOLD=$(tput bold)

# verify we meant to run this script
read -r -n 1 -p "${YELLOW}WARNING:${RESET} running this script deploys changes publicly. Are you sure you want to continue? [y/n] "
echo
echo
if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then exit 1; fi

# verify the user has required permissions
read -r -n 1 -p "Do you have a stripe npm account with 2FA? [y/n] "
echo
echo
if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then 
    echo "${RED}ERROR:${RESET} Please create a stripe npm account to continue"
    exit 1
fi

version=$(nodenv version | cut -d . -f 1)
if [ ! "${version}" -gt "12" ]; then
    echo "${RED}ERROR:${RESET} must have node version 12 or greater"
    echo "current version is ${YELLOW}$(nodenv version | cut -d ' ' -f 1)${RESET}"
    echo
    echo "set new node version with ${BOLD}nodenv shell 14.7.0${RESET} or any other installed version 12 or greater to continue"
    exit 1
fi
echo "${GREEN}SUCCESS:${RESET} your current node version is 12 or greater (${GREEN}$(nodenv version | cut -d ' ' -f 1)${RESET})"
echo

if ! npm team ls @stripe:developers &> /dev/null; then
    echo "Please login to your stripe npm account"
    npm login
fi

while ! npm team ls @stripe:developers &> /dev/null;
do
    echo
    echo "${RED}ERROR:${RESET} either you haven't logged into your stripe npm account or your account doesn't belong to the stripe org"
    echo
    echo "${RED_BG}verify${RESET} that you are logged in to your stripe npm account by running ${BOLD}npm whoami${RESET}"
    echo "${BOLD}npm whoami${RESET} should return ${GREEN}$USER-stripe${RESET}"
    current_npm_user=$(npm whoami)
    echo "${BOLD}npm whoami${RESET} currently returns ${RED}$current_npm_user${RESET}"
    echo
    echo "${RED_BG}verify${RESET} that you belong to the stripe org by checking your listed organizations at ${BOLD}https://npmjs.com/~$USER-stripe${RESET}"
    echo "if you don't belong to the stripe org, be sure to ping ${BOLD}#payments-web${RESET}"
    echo
    read -r -n 1 -p "Do you want to try again? [y/n] "
    echo
    if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then exit 1; fi
    echo
    echo "Please login to your stripe npm account"
    npm login
done

echo
echo "${GREEN}SUCCESS:${RESET} you are logged into your stripe npm account"
echo

# build the release artifact
if ! npm run test; then
    echo
    echo "${RED}ERROR:${RESET} some tests have failed, please fix them to continue"
    exit 1
fi

echo
echo "${GREEN}SUCCESS:${RESET} all tests have passed"
echo 

if ! rm stripe-firestore-stripe-payments-*.tgz; then
    echo
    echo "${RED}ERROR:${RESET} encountered an error removing old release artifacts"
    exit 1
fi

if ! npm run build; then
    echo
    echo "${RED}ERROR:${RESET} encountered an error while building the release artifact"
    exit 1
fi

if ! npm pack; then
    echo
    echo "${RED}ERROR:${RESET} encountered an error while building the release artifact"
    exit 1
fi

echo
echo "${GREEN}SUCCESS:${RESET} built the release artifact"
echo

read -r -n 1 -p "Did you notify #developer-products and #developer-advocacy about this release? [y/n] "
echo
echo
if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then 
    echo "${RED}ERROR:${RESET} Please notify #developer-products and #developer-advocacy before any release"
    exit 1
fi

# publish
if ! npm publish stripe-firestore-stripe-payments-*.tgz --access restricted; then
    echo
    echo "${RED}ERROR:${RESET} encountered an error while publishing new version"
    exit 1
fi

echo "${GREEN}SUCCESS:${RESET} published the new version!"