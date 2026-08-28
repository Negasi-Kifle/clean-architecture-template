import type { ISessionRepository, SessionEntity } from "../../../domain";

/** "Where am I signed in?" — the list a user needs in order to revoke a device. */
export class ListSessionsUseCase {
    constructor(private readonly sessionRepository: ISessionRepository) {}

    async execute(userId: string): Promise<SessionEntity[]> {
        return this.sessionRepository.findActiveByUserId(userId);
    }
}
