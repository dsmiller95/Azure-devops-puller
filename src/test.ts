import { getPrData, getAzureApiConnection, getPulsePattern } from './index';
import { PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces';

(async() => {
    try {
        const token = '';
        const connection = await getAzureApiConnection(token);
        const prData = await getPrData(connection, 100, {
        });
        console.log(JSON.stringify(prData.prs.map(pr => pr.author)));

        const pulsePattern = await getPulsePattern(token, 1000);
        console.log(JSON.stringify(pulsePattern));
    } catch (e) {
        console.log("ERR");
        console.log(e);
    }
})();