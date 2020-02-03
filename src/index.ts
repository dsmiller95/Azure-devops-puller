import fetch from 'node-fetch';
import * as azureDevApi from "azure-devops-node-api";
import { GitPullRequest } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { ConnectionData } from 'azure-devops-node-api/interfaces/LocationsInterfaces';

import { IotData } from 'aws-sdk';

interface ReturnType {
    success: boolean;
    prs?: PullRequestSummary[];
    token?: string;
    connection?: ConnectionData;
    hasNewPr?: boolean;
}

interface PullRequestSummary {
    age: number;
    description: string;
    title: string;
}

const repositoryID = '654d2cf2-fe1f-4f47-9eee-4a92f00c2174';
const orgUrl = "https://dev.azure.com/symplr";
const projectName = "Provider Management";

// if there was a PR created in the last 10 minutes, it is new
const maxAgeOfNewPr: number = 10 * 60 * 1000;

exports.handler = async (event: any): Promise<ReturnType> => {

    let token = process.env.AZURE_PERSONAL_ACCESS_TOKEN;
    if(!token){
        return {success: false};
    }

    let authHandler = azureDevApi.getPersonalAccessTokenHandler(token); 
    let connection = new azureDevApi.WebApi(orgUrl, authHandler);

    const gitApi = await connection.getGitApi();
    const prs: GitPullRequest[] = await gitApi.getPullRequests(repositoryID, {
        repositoryId: repositoryID
    }, projectName);

    const currentTime = (new Date()).valueOf();
    const prsByAgeAscending: PullRequestSummary[] = prs
        .map(pr => ({age: currentTime - (pr.creationDate?.valueOf() ?? 0), title: pr.title ?? '', description: pr.description ?? ''}) )
        .sort((prA, prB) => prA.age - prB.age);

    const hasNewPr = prsByAgeAscending[0].age < maxAgeOfNewPr;
    await transmitResultToIot(hasNewPr);

    return {
        success: true,
        hasNewPr,
        prs: prsByAgeAscending
    };
};

async function transmitResultToIot(result: boolean): Promise<any>{
    let endpoint: string = process.env.IOT_ENDPOINT ?? '';
    const iotData = new IotData({apiVersion: '2015-05-28', endpoint});
    let params: IotData.PublishRequest = {
        topic: 'ACswitch/switch', /* required */
        payload: result ? 'true' : 'false'  /* Strings will be Base-64 encoded on your behalf */,
        qos: 1
    };

    iotData.publish(params);

    return null;// published.$response.data;
}