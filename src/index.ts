import fetch from 'node-fetch';
import * as azureDevApi from "azure-devops-node-api";
import { WebApi } from "azure-devops-node-api";
import { GitPullRequest, PullRequestStatus, GitPullRequestSearchCriteria } from 'azure-devops-node-api/interfaces/GitInterfaces';
import { ConnectionData } from 'azure-devops-node-api/interfaces/LocationsInterfaces';

import { IotData } from 'aws-sdk';

interface ReturnType {
    success: boolean;
    prs?: PullRequestSummary[];
    token?: string;
    patternTransmitted?: PulseDefinition | null;
    hasNewPr?: boolean;
}

interface PullRequestSummary {
    age: number;
    description: string;
    title: string;
    author: string;
}
function summarizePr(pullRequest: GitPullRequest, currentTimeMillis: number): PullRequestSummary {
    return {
        age: currentTimeMillis - (pullRequest.creationDate?.valueOf() ?? 0),
        title: pullRequest.title ?? '',
        description: pullRequest.description ?? '',
        author: pullRequest.createdBy?.displayName ?? ''
    }
}

interface PulseDefinition {
    pattern: string;
    interval: number;
}

interface PulseMap {
    newPr: PulseDefinition;
    newTeamPr: {[team: string]: PulseDefinition};
}

const repositoryID = '654d2cf2-fe1f-4f47-9eee-4a92f00c2174';
const orgUrl = "https://dev.azure.com/symplr";
const projectName = "Provider Management";

const teamDef: {[team: string]: string[]} = {
    "Danakil": ["Andrew Donahoe", "Kelly O'Callaghan", "Josh Boyce", "Shane Cook", "James Pemberton"],
    "Arctic": ["Andrew Wied", "Wade Carlson", "Duane Raiche", "Tom Duex", "Brian Kapellusch"],
    "Mojave": ["Dan Miller", "Katie Lawton", "Tanner Irons", "Todd Schmitt"]
}

async function handler(event: any): Promise<ReturnType> {
    let token = process.env.AZURE_PERSONAL_ACCESS_TOKEN;
    if(!token){
        return {success: false};
    }

    const pulsePattern = await getPulsePattern(
        token,
        parseInt(process.env.NEW_PR_MINUTE_THRESHOLD ?? '10'),
        process.env.PULSE_RULE_MAP ? JSON.parse(process.env.PULSE_RULE_MAP) : undefined);

    if(!!pulsePattern) {
        const iotData = new IotData({apiVersion: '2015-05-28', endpoint: process.env.IOT_ENDPOINT ?? ''});
        await transmitPulseToIot(pulsePattern, iotData);
    }

    return {
        success: true,
        patternTransmitted: pulsePattern
    };
};

async function getPulsePattern(
    azureToken: string,
    prAgeThresholdMinutes: number,
    pulseMap?: PulseMap): Promise<PulseDefinition | null>{
    const maxAgeOfNewPr: number = prAgeThresholdMinutes * 60 * 1000;

    const pulseMapping: PulseMap = pulseMap ?? {
            newPr: {
                pattern: 'XXXX----XX--X',
                interval: 200
            },
            newTeamPr: {
                default: {
                    pattern: 'XX--X',
                    interval: 200
                },
                Danakil: {
                    pattern: 'X--XX--XX',
                    interval: 200
                },
                Arctic: {
                    pattern: 'XX--X--XX',
                    interval: 200
                },
                Mojave: {
                    pattern: 'XX--XX--X',
                    interval: 200
                },
            }
        };

    let azureApiConnection = await getAzureApiConnection(azureToken);
    let prData = await getPrData(azureApiConnection, maxAgeOfNewPr);

    if(!prData.newPr){
        return null;
    }
    const team = getTeamForPr(prData.newPr, teamDef);
    return pulseMapping.newTeamPr[team] ?? pulseMapping.newPr;
}

function getTeamForPr(prSummary: PullRequestSummary, authorMap: {[team: string]: string[]}): string{
    for(let team in authorMap){
        if(authorMap[team].indexOf(prSummary.author) >= 0){
            return team;
        }
    }
    return "default";
}

async function getAzureApiConnection(token: string): Promise<WebApi> {
    let authHandler = azureDevApi.getPersonalAccessTokenHandler(token); 
    return new WebApi(orgUrl, authHandler);
}

async function getPrData(
    connection: WebApi,
    newPrThreshold: number,
    additionalRequestOptions?: Partial<GitPullRequestSearchCriteria>) : Promise<{prs: PullRequestSummary[], newPr: PullRequestSummary | null}>
{
    const prs: GitPullRequest[] = await getPrRawData(connection, additionalRequestOptions);

    const currentTime = (new Date()).valueOf();
    const prsByAgeAscending: PullRequestSummary[] = prs
        .map(pr => summarizePr(pr, currentTime))
        .sort((prA, prB) => prA.age - prB.age);

    const hasNewPr = prsByAgeAscending[0].age < newPrThreshold;

    return {
        prs: prsByAgeAscending,
        newPr: hasNewPr ? prsByAgeAscending[0] : null
    }
}


async function getPrRawData(
    connection: WebApi,
    additionalRequestOptions?: Partial<GitPullRequestSearchCriteria>) : Promise<GitPullRequest[]>
{
    const gitApi = await connection.getGitApi();
    let searchCriteria = additionalRequestOptions ?? {};
    const prs: GitPullRequest[] = await gitApi.getPullRequests(repositoryID, {
        ...searchCriteria,
        repositoryId: repositoryID,
    },
    projectName,
    0);

    return prs;
}


async function transmitPulseToIot(pulseDef: PulseDefinition, dataAPI: IotData) {
    let params: IotData.PublishRequest = {
        topic: 'ACswitch/interval', /* required */
        payload: JSON.stringify({pattern: pulseDef.pattern, interval: pulseDef.interval.toFixed(0)})  /* Strings will be Base-64 encoded on your behalf */,
        qos: 1
    };

    return await dataAPI.publish(params).promise();
}

async function transmitResultToIot(result: boolean, dataAPI: IotData): Promise<any>{
    let params: IotData.PublishRequest = {
        topic: 'ACswitch/switch', /* required */
        payload: result ? 'true' : 'false'  /* Strings will be Base-64 encoded on your behalf */,
        qos: 1
    };

    return await dataAPI.publish(params).promise();
}

export {
    handler,
    getPrData,
    getPrRawData,
    getAzureApiConnection,
    getPulsePattern
};