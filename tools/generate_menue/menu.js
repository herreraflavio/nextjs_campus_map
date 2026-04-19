const fs = require("fs").promises;

async function generateAllMenus() {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const compId = "61bd7ecd8c760e0011ac0fac";
  const deviceId = "d1f39079-6fac-4eac-bf37-29208df87571";

  const ywdcMeals = [
    "Lunch",
    "Dinner",
    "Late Night",
    "Midori Lunch/Dinner",
    "Midori Late Night",
    "Suannai",
    "Baked 'n' Grams",
  ];
  const pavMeals = [
    "Breakfast",
    "Lunch",
    "Dinner",
    "Bakery",
    "FoG Breakfast",
    "FoG Lunch & Dinner",
    "CG Lunch & Dinner",
  ];

  const createEndpoints = () => {
    const endpoints = [];

    // --- YWDC (Monday - Friday) ---
    const ywdcData = {
      Monday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe23e615eb39f2b65a5e&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe4de615eb39f2b65e9f&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=63320eb6007b6b0010480cad&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969546c51a912b229ba172d&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969548177b727b0edc87615&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=696954f151a912b229ba1890&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969537651a912b229ba16f5&locationId=628672b52903a50010fa751e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Tuesday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe23e615eb39f2b65a5e&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe4de615eb39f2b65e9f&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=63320eb6007b6b0010480cad&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969546c51a912b229ba172d&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969548177b727b0edc87615&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=696954f151a912b229ba1890&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969537651a912b229ba16f5&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Wednesday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe23e615eb39f2b65a5e&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe4de615eb39f2b65e9f&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=63320eb6007b6b0010480cad&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969546c51a912b229ba172d&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969548177b727b0edc87615&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=696954f151a912b229ba1890&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969537651a912b229ba16f5&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Thursday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe23e615eb39f2b65a5e&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe4de615eb39f2b65e9f&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=63320eb6007b6b0010480cad&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969546c51a912b229ba172d&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969548177b727b0edc87615&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=696954f151a912b229ba1890&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969537651a912b229ba16f5&locationId=628672b52903a50010fa751e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Friday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe23e615eb39f2b65a5e&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=64b6fe4de615eb39f2b65e9f&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=63320eb6007b6b0010480cad&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969546c51a912b229ba172d&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969548177b727b0edc87615&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=696954f151a912b229ba1890&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=6969537651a912b229ba16f5&locationId=628672b52903a50010fa751e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
    };

    // --- PAV (Sunday - Saturday) ---
    const pavData = {
      Sunday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd808b5f2f930010bb6a7a&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Monday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80908b34640010e194b3&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Tuesday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ab5f2f930010bb6a7d&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Wednesday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b08b34640010e194b4&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Thursday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80b55f2f930010bb6a7e&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Friday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80ba5f2f930010bb6a7f&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
      Saturday: [
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d68b34640010e194b8&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80d05f2f930010bb6a81&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61bd80cc5f2f930010bb6a80&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62d9c7c26c04ea00104859c7&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=62daecc36c04ea001048a55d&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed885a9be79300147d3898&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
        "https://widget.api.eagle.bigzpoon.com/menuitems?categoryId=61ed97b39be79300147d3d06&locationId=61df4a34d5507a00103ee41e&menuGroupId=61bd80bf8b34640010e194b6&userPreferences=%7B%22allergies%22:%5B%5D,%22lifestyleChoices%22:%5B%5D,%22medicalGoals%22:%5B%5D,%22preferenceApplyStatus%22:false%7D",
      ],
    };

    for (const [day, urls] of Object.entries(ywdcData)) {
      urls.forEach((url, index) => {
        endpoints.push({ loc: "YWDC", day, meal: ywdcMeals[index], url });
      });
    }
    for (const [day, urls] of Object.entries(pavData)) {
      urls.forEach((url, index) => {
        endpoints.push({ loc: "PAV", day, meal: pavMeals[index], url });
      });
    }
    return endpoints;
  };

  const fetchQueue = createEndpoints();

  // Storage structure: parsedData[loc][day][meal] = [ array of item sections ]
  const parsedData = { YWDC: {}, PAV: {} };

  console.log(
    `Starting fetch for ${fetchQueue.length} endpoints. This will take about ${fetchQueue.length} seconds...`,
  );

  for (let i = 0; i < fetchQueue.length; i++) {
    const { loc, day, meal, url } = fetchQueue[i];
    const urlParams = new URLSearchParams(url.split("?")[1]);
    const locationId = urlParams.get("locationId");

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json, text/plain, */*",
          "x-comp-id": compId,
          "location-id": locationId,
          "device-id": deviceId,
        },
      });

      if (!response.ok) {
        console.warn(`[${loc} - ${day} - ${meal}] Failed: ${response.status}`);
        continue;
      }

      const json = await response.json();
      const menuItems = json.data?.menuItems || [];

      // Ensure the nested arrays exist
      if (!parsedData[loc][day]) parsedData[loc][day] = {};
      if (!parsedData[loc][day][meal]) parsedData[loc][day][meal] = [];

      menuItems.forEach((item) => {
        // Prevent adding duplicate items within the same meal block
        const itemAlreadyExists = parsedData[loc][day][meal].some(
          (s) => s.header === item.name,
        );

        if (!itemAlreadyExists) {
          const bullets = [];
          let desc = item.description || "";

          // Optionally extract the station from the description if you want it looking clean
          if (desc.includes(":")) {
            const parts = desc.split(":");
            const station = parts[0].replace(/[@π]/g, "").trim();
            desc = parts.slice(1).join(":").trim();
            if (station) bullets.push(`Station: ${station}`);
          }

          if (desc) bullets.push(`Description: ${desc}`);
          if (item.caloriesInfo) bullets.push(`Calories: ${item.caloriesInfo}`);

          // Construct the section object for this specific item
          const section = {
            header: item.name,
          };

          // Attach image_urls if a valid imageUrl exists
          if (item.imageUrl && item.imageUrl.trim() !== "") {
            section.image_urls = [item.imageUrl];
          }

          // Attach the details to the bullets array
          section.bullets = bullets;

          // Push to our meal array
          parsedData[loc][day][meal].push(section);
        }
      });

      console.log(
        `Fetched ${i + 1}/${fetchQueue.length}: [${loc}] ${day} - ${meal}`,
      );
    } catch (error) {
      console.error(
        `Error on URL ${i + 1}/${fetchQueue.length}:`,
        error.message,
      );
    }

    // Strict 1-second delay
    await sleep(1000);
  }

  // Builder function to structure the JSON into the nested_content schema
  const buildNestedContentArray = (locationData) => {
    const daysOrder = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const activeDays = Object.keys(locationData).sort(
      (a, b) => daysOrder.indexOf(a) - daysOrder.indexOf(b),
    );

    return activeDays.map((day) => {
      const mealTabs = Object.keys(locationData[day]).map((mealName) => {
        return {
          title: mealName,
          // Since our logic already formats each item as a full section object,
          // we can just directly assign the array here.
          sections: locationData[day][mealName],
        };
      });

      return {
        title: day,
        tabs: mealTabs,
      };
    });
  };

  const finalOutput = {
    YWDC_nested_content: buildNestedContentArray(parsedData.YWDC),
    PAV_nested_content: buildNestedContentArray(parsedData.PAV),
  };

  console.log("----- FETCH COMPLETE, WRITING TO FILE -----");

  try {
    await fs.writeFile("menus.json", JSON.stringify(finalOutput, null, 2));
    console.log("Successfully saved structured data to menus.json!");
  } catch (err) {
    console.error("Failed to write to file:", err);
  }
}

generateAllMenus();
