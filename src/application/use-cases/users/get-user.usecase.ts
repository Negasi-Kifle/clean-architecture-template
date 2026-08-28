import {
    NotFoundError,
    type AuthenticatedPrincipal,
    type IUserRepository,
    type UserEntity,
} from "../../../domain";
import { assertSelfOrTenantAdmin } from "../../authorization";

export class GetUserUseCase {
    constructor(private readonly userRepository: IUserRepository) {}

    async execute(principal: AuthenticatedPrincipal, userId: string): Promise<UserEntity> {
        assertSelfOrTenantAdmin(principal, userId);

        const user = await this.userRepository.findById(userId);
        if (!user) throw new NotFoundError("User", userId);
        return user;
    }
}
