import { getAzureApiConnection, getPrData, getPulsePattern, getPrRawData } from './index';
import { PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { writeFile } from 'fs';
import { PullRequestTimeSpanSummary } from './models';


(async() => {
    try {
        const token = '';
        const connection = await getAzureApiConnection(token);
        const prData = await getPrRawData(connection, {
            status: PullRequestStatus.Completed
        });
        const timeSummaries = prData.map(d => new PullRequestTimeSpanSummary(d));
        const data = JSON.stringify(timeSummaries);
        writeFile('data.json', data, () => {
            console.log("write done");
        }); 
        //console.log(JSON.stringify(prData.prs.map(pr => pr.author)));
        //console.log(JSON.stringify(prData));

        const pulsePattern = await getPulsePattern(token, 1000);
        console.log(JSON.stringify(pulsePattern));
    } catch (e) {
        console.log("ERR");
        console.log(e);
    }
})();