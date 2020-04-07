var cheerio = require("cheerio");
var fetch = require("node-fetch");
var fs = require("fs");

async function getPageJQuery(url) { return cheerio.load(await (await fetch(url)).text()); }

var baseUrl = "https://www.inflation.eu/";
var timezoneOffset = Date.parse("january 1970");

(async function () {

    var results = [];

    var types = ["cpi", "hicp"]
    for (let t = 0; t < types.length; t++) {
        var years = await getYears(types[t])
        var countryTasks = years.map(y => getCountriesForYear(types[t], y));
        for (let y = 0; y < years.length; y++) {
            var countries = await countryTasks[y];
            var inflationDataTasks = countries.map(c=> getDataForCountryYear(types[t], years[y], c))
            for (let c = 0; c < countries.length; c++) {
                var inflationData = await inflationDataTasks[c];
                results.push({ type: types[t], year: years[y], country: countries[c], inflationData: inflationData });
                console.log("Done with " + types[t] + " data from " + years[y] + ", " + countries[c]);
            }
        }
    }

    fs.writeFileSync("results.json", JSON.stringify(results));
    console.log("DONE!")

    async function getYears(type) {
        var url = baseUrl + "inflation-rates/historic-" + type.toLowerCase() + "-inflation.aspx";
        var $ = await getPageJQuery(url);
        var links = $(".tabledatalink");

        var linkTexts = [];
        links.map(i => linkTexts.push($(links[i]).text().toString().trim()));

        var linkTextStart = type.toUpperCase() + " inflation ";
        var correctTexts = linkTexts.filter(i => i.startsWith(linkTextStart));
        var years = correctTexts.map(i => i.substr(linkTextStart.length)).sort();
        return years;
    }

    async function getCountriesForYear(type, year) {
        var url = baseUrl + "inflation-rates/" + type.toLowerCase() + "-inflation-" + year + ".aspx";
        var $ = await getPageJQuery(url);
        var links = $(".tabledatalink");

        var linkTexts = [];
        links.map(i => linkTexts.push($(links[i]).text().toString().trim()));

        var linkTextStart = type.toUpperCase() + " inflation ";
        var correctTexts = linkTexts.filter(i => i.startsWith(linkTextStart) && i.endsWith(year.toString()));
        var countryAndYears = correctTexts.map(i => i.substr(linkTextStart.length).trim());
        var countries = countryAndYears.map(i => i.substring(0, i.lastIndexOf(" ")).trim());
        return countries.sort();
    }

    async function getDataForCountryYear(type, year, country) {
        var url = baseUrl + "inflation-rates/" + country + "/historic-inflation/" + type + "-inflation-" + country + "-" + year + ".aspx";
        var $ = await getPageJQuery(url);
        var links = $("tr > td:nth-child(4)");
        // only with date text
        links = links.filter(i => !isNaN(Date.parse($(links[i]).text().split(" - ")[0])))
        linkParents = links.map(i => links[i].parent);

        var texts = [];
        linkParents.map(i => texts.push($(linkParents[i]).text()));

        var monthlyInflation = [];
        var yearlyInflation = [];

        texts.forEach(t => {
            var lines = t.replace(/\n/g, '\\n').trim().split('\\n').map(i=>i.trim()).filter(i=>i != "");

            var mPeriod = lines[0].split(" - ").reverse();
            var mPeriodParsed = mPeriod.map(i => Date.parse(i)-timezoneOffset)
            var mPercent = lines[1];

            var yPeriod = lines[2].split(" - ").reverse();
            var yPeriodParsed = yPeriod.map(i => Date.parse(i)-timezoneOffset)
            var yPercent = lines[3];

            monthlyInflation.push({period: mPeriod, periodParsed: mPeriodParsed, percent: mPercent});
            yearlyInflation.push({period: yPeriod, periodParsed: yPeriodParsed, percent: yPercent});
        });

        return { monthlyInflation, yearlyInflation };
    }
})();