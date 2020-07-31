import { Moment } from "moment";
import { GitPullRequest } from "azure-devops-node-api/interfaces/GitInterfaces";
import moment from "moment";

export class PullRequestTimeSpanSummary{
    public id?: number;
    public creationDate: Moment;
    public completedDate?: Moment;
    public description?: string;

    constructor(pullRequest: GitPullRequest){
        this.id = pullRequest.pullRequestId;
        this.creationDate = moment(pullRequest.creationDate);
        if(pullRequest.closedDate){
            this.completedDate = moment(pullRequest.closedDate);
        }
        //this.completedDate = moment(pullRequest.creationDate);
        this.description = pullRequest.title;
    }
}