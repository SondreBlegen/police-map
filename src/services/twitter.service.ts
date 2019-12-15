import * as twitter from 'twitter';

export class Twitter {
    private twitterUsername: string;

    constructor() {
        this.twitterUsername = process.env.twitter_username;
    }

    public async fetchFeed() {
        console.log('foo');
    }
}
