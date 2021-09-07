const Sequelize = require("sequelize");
const { STRING } = Sequelize;
const config = {
    logging: false
};
const jwt = require("jsonwebtoken");
const SECRET_KEY = process.env.JWT;
const bcrypt = require("bcrypt");
const saltRounds = 10;

if (process.env.LOGGING) {
    delete config.logging;
}
const conn = new Sequelize(
    process.env.DATABASE_URL || "postgres://localhost/acme_db",
    config
);

const User = conn.define("user", {
    username: STRING,
    password: STRING
});

const Note = conn.define("note", {
    text: STRING
});

Note.belongsTo(User);
User.hasMany(Note);

User.addHook("beforeCreate", async (user) => {
    user.password = await bcrypt.hash(user.password, saltRounds);
});

User.byToken = async (token) => {
    try {
        const verifyToken = jwt.verify(token, SECRET_KEY);
        console.log("VERIFIED TOKEN >>", verifyToken);
        const user = await User.findByPk(verifyToken.id);
        if (user) {
            return user;
        }
        const error = Error("bad credentials");
        error.status = 401;
        throw error;
    } catch (ex) {
        const error = Error("bad credentials");
        error.status = 401;
        throw error;
    }
};

User.authenticate = async ({ username, password }) => {
    const user = await User.findOne({
        where: {
            username
        }
    });

    if (await bcrypt.compare(password, user.password)) {
        const token = jwt.sign(
            { id: user.id, username: user.username },
            SECRET_KEY
        );
        console.log("TOKEN >>", token);
        return token;
    }
    const error = Error("bad credentials");
    error.status = 401;
    throw error;
};

const syncAndSeed = async () => {
    await conn.sync({ force: true });
    const credentials = [
        { username: "lucy", password: "lucy_pw" },
        { username: "moe", password: "moe_pw" },
        { username: "larry", password: "larry_pw" }
    ];
    const [lucy, moe, larry] = await Promise.all(
        credentials.map((credential) => User.create(credential))
    );

    const notes = [{ text: "note-1" }, { text: "note-2" }, { text: "note-3" }];
    const [note1, note2, note3] = await Promise.all(
        notes.map((note) => Note.create(note))
    );

    await lucy.setNotes([note1, note2, note3]);
    await moe.setNotes([note2]);

    return {
        users: {
            lucy,
            moe,
            larry
        }
    };
};

module.exports = {
    syncAndSeed,
    models: {
        User,
        Note
    }
};
